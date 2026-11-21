// A dog's page: who it is, "Ask AI help about …", the care reminders (Done today and
// Set date work right here and are saved at once), the health file in short, and my
// vet. The profile is edited behind Edit (src/app/dog/edit/[id].tsx, saved with Done).
// /dog/new is the form to add a dog. A reminder's notification opens this page.
import { useCallback, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../i18n";
import {
  getDog, listReminders, markDone, notificationsAllowed, REMINDER_KINDS, setReminder, today, validDate,
  type Dog, type Reminder, type ReminderKind
} from "../../lib/dogs";
import { exportPdf, listRecords, recurring, type DogRecord } from "../../lib/dogfile";
import { keyFacts } from "../../lib/dogfileview";
import { breedLabel, breeds } from "../../lib/breeds";
import { formatDate } from "../../lib/dates";
import { myVet, type SavedPlace } from "../../lib/saved";
import { remember } from "../../lib/placeStore";
import { callUrl, displayName, OpenBadge } from "../../ui/PlaceCard";
import { DateField } from "../../ui/DateField";
import { DogAvatar } from "../../ui/DogAvatar";
import { DogForm } from "../../ui/DogForm";
import { ageText, sexText } from "../../ui/dogInfo";
import { HeaderButton } from "../../ui/HeaderButton";
import { Icon, Symbol } from "../../ui/Icon";
import { useTheme } from "../../ui/theme";

export default function DogRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id === "new" ? <NewDog /> : <Overview dogId={Number(id)} />;
}

function NewDog() {
  const { t } = useI18n();
  return (
    <>
      <Stack.Screen options={{ title: t("app_addDog") }} />
      <DogForm dogId={null} onSaved={() => router.back()} />
    </>
  );
}

const unique = (xs: string[]) => xs.filter((x, i) => xs.findIndex((y) => y.toLocaleLowerCase() === x.toLocaleLowerCase()) === i);

function Overview({ dogId }: { dogId: number }) {
  const { t, tf, lang } = useI18n();
  const { C, S } = useTheme();
  const [dog, setDog] = useState<Dog | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [records, setRecords] = useState<DogRecord[]>([]);
  const [vet, setVet] = useState<SavedPlace | null>(null);
  const [open, setOpen] = useState<ReminderKind | null>(null);      // the reminder showing all its actions
  const [working, setWorking] = useState<ReminderKind | null>(null);
  const [notifOff, setNotifOff] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const lock = useRef(false);   // one reminder change at a time (each one reschedules its notification)
  const gone = useRef(false);

  const load = useCallback(async () => {
    const d = await getDog(dogId);
    if (!d) {   // deleted (or a stale link): back to where we came from
      if (!gone.current) { gone.current = true; if (router.canGoBack()) router.back(); else router.replace("/dogs"); }
      return;
    }
    setDog(d);
    setReminders(await listReminders(dogId));
    setRecords(await listRecords(dogId));
    setVet(await myVet().catch(() => null));
  }, [dogId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  const kindName = (k: ReminderKind) => t(REMINDER_KINDS.find((x) => x.kind === k)!.key);

  const change = async (kind: ReminderKind, job: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setWorking(kind);
    try { await job(); }
    catch { Alert.alert(t("app_actionFailed")); }
    finally {
      lock.current = false; setWorking(null);
      setReminders(await listReminders(dogId).catch(() => reminders));
    }
  };
  const doneToday = (r: Reminder) => change(r.kind, async () => {
    await markDone(r);
    const next = (await listReminders(dogId)).find((x) => x.kind === r.kind);
    if (next?.due) AccessibilityInfo.announceForAccessibility(`${kindName(r.kind)}: ${tf("app_nextDue", { date: formatDate(next.due, lang) })}`);
  });
  const setDue = (kind: ReminderKind, due: string | null) => {
    if (due && !validDate(due)) { Alert.alert(t("app_invalidDate")); return; }
    return change(kind, async () => {
      if (due) setNotifOff(!(await notificationsAllowed(true).catch(() => true)));
      await setReminder(dogId, kind, due);
    });
  };

  const pdf = async () => {
    setPdfBusy(true);
    try { await exportPdf(dogId, t, tf, lang); } catch { Alert.alert(t("app_actionFailed")); } finally { setPdfBusy(false); }
  };
  const openVet = (p: SavedPlace) => {
    remember(p);
    router.push({ pathname: "/place/[id]", params: { id: p.id, lat: String(p.lat), lon: String(p.lon) } });
  };

  if (!dog) return <View style={S.screen}><Stack.Screen options={{ title: "" }} /></View>;

  const breed = breedLabel(breeds(), dog, lang, t, tf);
  const meta = [ageText(dog, tf), dog.weight ? dog.weight + " kg" : null, sexText(dog, t)].filter(Boolean).join(" · ");
  const hair = StyleSheet.hairlineWidth;

  // ---- the health file in short ----
  const facts = keyFacts(records), again = recurring(records);
  const fileItems: { key: string; icon: ReactNode; label: string; value: string; warn?: boolean }[] = [];
  if (facts.allergies.length) fileItems.push({ key: "allergy", icon: <Icon name="alert-triangle" size={18} color={C.warn} />, label: t("app_rec_allergy"),
    value: unique(facts.allergies.map((a) => a.title)).join(", ") });
  if (facts.medication) fileItems.push({ key: "medication", icon: <Symbol name="pill" size={18} color={C.muted} />, label: t("app_latestMedication"),
    value: `${facts.medication.title} · ${formatDate(facts.medication.date, lang)}` });
  if (again.length) fileItems.push({ key: "again", icon: <Icon name="repeat" size={18} color={C.warn} />, label: t("app_recurring"), warn: true,
    value: again.map((g) => `${t("app_sign_" + g.category)} (${tf("app_recurringTimes", { n: g.dates.length })}): ${g.dates.map((d) => formatDate(d, lang)).join(", ")}`).join("\n") });
  if (facts.visit) fileItems.push({ key: "visit", icon: <Symbol name="stethoscope" size={18} color={C.muted} />, label: t("app_latestVisit"),
    value: `${facts.visit.title} · ${formatDate(facts.visit.date, lang)}` });

  const ghost = (pressed: boolean) => [S.btnGhost, S.row, { minHeight: 44, gap: 6, paddingHorizontal: 12 }, pressed && S.pressed];

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}>
      <Stack.Screen options={{
        title: dog.name,
        headerRight: () => <HeaderButton label={t("app_edit")} onPress={() => router.push({ pathname: "/dog/edit/[id]", params: { id: String(dogId) } })} />
      }} />

      <View style={[S.row, { gap: 14 }]}>
        <DogAvatar name={dog.name} photo={dog.photo} size={76} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: "700", color: C.text }} accessibilityRole="header">{dog.name}</Text>
          {!!breed && <Text style={S.body}>{breed}</Text>}
          {!!meta && <Text style={[S.muted, { fontSize: 14, lineHeight: 20 }]}>{meta}</Text>}
        </View>
      </View>

      {/* The AI help tab with this dog chosen (ask.tsx reads ?dog=). dismissTo goes back to
          the tabs under this page; navigate would push a second set of tabs on the stack. */}
      <Pressable onPress={() => router.dismissTo({ pathname: "/ask", params: { dog: String(dogId) } })} accessibilityRole="button"
        style={({ pressed }) => [S.btn, S.row, { gap: 8, minHeight: 48 }, pressed && S.pressed]}>
        <Icon name="message-circle" size={20} color={C.onBrand} />
        <Text style={[S.btnText, { flexShrink: 1, textAlign: "center" }]}>{tf("app_askAboutDog", { name: dog.name })}</Text>
      </Pressable>

      {/* Care reminders: an overdue one has Done today right here; tap one for all its actions */}
      <View style={[S.card, { paddingHorizontal: 0, paddingTop: 12, paddingBottom: 4 }]}>
        <View style={[S.row, { gap: 8, paddingHorizontal: 14, paddingBottom: 8 }]}>
          <Icon name="bell" size={20} color={C.muted} />
          <Text style={S.h2} accessibilityRole="header">{t("app_reminders")}</Text>
        </View>
        {notifOff && <Text style={[S.muted, { color: C.warn, paddingHorizontal: 14, paddingBottom: 8 }]}>{t("app_notifDenied")}</Text>}
        {REMINDER_KINDS.map((k) => {
          const r = reminders.find((x) => x.kind === k.kind);
          const due = r?.due ?? null;
          const overdue = !!due && due < today();
          const expanded = open === k.kind && !!due;
          const busy = working === k.kind;
          const status = due ? (overdue ? `${t("app_overdue")} · ${formatDate(due, lang)}` : tf("app_nextDue", { date: formatDate(due, lang) })) : t("app_notSet");
          const label = (
            <View style={{ flex: 1 }}>
              <Text style={[S.body, { fontWeight: "600" }]}>{t(k.key)}</Text>
              <Text style={[S.muted, { fontSize: 14, lineHeight: 20 }, overdue && { color: C.danger, fontWeight: "700" }]}>{status}</Text>
            </View>
          );
          const doneBtn = r && (
            <Pressable onPress={() => doneToday(r)} disabled={busy} accessibilityRole="button" accessibilityLabel={`${t("app_markDone")}: ${t(k.key)}`}
              style={({ pressed }) => ghost(pressed)}>
              <Icon name="check" size={16} color={C.ok} />
              <Text style={[S.btnGhostText, { fontSize: 14 }]}>{t("app_markDone")}</Text>
            </Pressable>
          );
          const dateBtn = (plain: boolean) => (
            <DateField value={due || ""} onChange={(iso) => setDue(k.kind, iso)} accessibilityLabel={`${t("app_setDate")}: ${t(k.key)}`}>
              {plain
                ? <View style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}><Text style={{ color: C.link, fontWeight: "700", fontSize: 14 }}>{t("app_setDate")}</Text></View>
                : <View style={[S.btnGhost, S.row, { minHeight: 44, gap: 6, paddingHorizontal: 12 }]}><Icon name="calendar" size={16} /><Text style={[S.btnGhostText, { fontSize: 14 }]}>{t("app_setDate")}</Text></View>}
            </DateField>
          );
          return (
            <View key={k.kind} style={{ borderTopWidth: hair, borderColor: C.line }}>
              <View style={[S.row, { minHeight: 56, paddingLeft: 14, paddingRight: 8, gap: 8 }]}>
                {due ? (
                  <Pressable onPress={() => setOpen(expanded ? null : k.kind)} accessibilityRole="button" accessibilityState={{ expanded }}
                    accessibilityLabel={`${t(k.key)}, ${status}`}
                    style={({ pressed }) => [S.row, { flex: 1, gap: 8, minHeight: 56, paddingVertical: 6 }, pressed && S.pressed]}>
                    {label}
                    <Icon name={expanded ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
                  </Pressable>
                ) : (
                  <View style={[S.row, { flex: 1, minHeight: 56, paddingVertical: 6 }]} accessible accessibilityLabel={`${t(k.key)}, ${status}`}>{label}</View>
                )}
                {busy ? <ActivityIndicator color={C.link} style={{ marginHorizontal: 12 }} /> : overdue ? doneBtn : !due ? dateBtn(true) : null}
              </View>
              {expanded && r && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
                  <Text style={S.muted}>{tf("app_every", { n: r.everyMonths })}</Text>
                  <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
                    {!overdue && doneBtn}
                    {dateBtn(false)}
                    <Pressable onPress={() => { setOpen(null); setDue(k.kind, null); }} disabled={busy} accessibilityRole="button" accessibilityLabel={`${t("app_remove")}: ${t(k.key)}`}
                      style={({ pressed }) => ghost(pressed)}>
                      <Text style={[S.btnGhostText, { fontSize: 14 }]}>{t("app_remove")}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* The health file in short: what a vet or a sitter asks first */}
      <View style={[S.card, { gap: 10 }]}>
        <View style={[S.row, { gap: 8 }]}>
          <Icon name="file-text" size={20} color={C.muted} />
          <Text style={[S.h2, { flex: 1 }]} accessibilityRole="header">{t("app_dogFile")}</Text>
        </View>
        {fileItems.length ? fileItems.map((it) => (
          <View key={it.key} style={[S.row, { gap: 10, alignItems: "flex-start" }]} accessible accessibilityLabel={`${it.label}: ${it.value}`}>
            <View style={{ marginTop: 2 }}>{it.icon}</View>
            <View style={{ flex: 1 }}>
              <Text style={[S.muted, it.warn && { color: C.warn, fontWeight: "700" }]}>{it.label}</Text>
              <Text style={S.body}>{it.value}</Text>
            </View>
          </View>
        )) : <Text style={S.muted}>{t("app_dogFileIntro")}</Text>}
        <View style={[S.row, { gap: 8, flexWrap: "wrap", marginTop: 2 }]}>
          <Pressable onPress={() => router.push({ pathname: "/dog/file/[id]", params: { id: String(dogId) } })} accessibilityRole="button"
            style={({ pressed }) => [...ghost(pressed), { flexGrow: 1, flexBasis: 140 }]}>
            <Text style={S.btnGhostText}>{t("app_openFile")}</Text>
            <Icon name="chevron-right" size={16} />
          </Pressable>
          <Pressable onPress={pdf} disabled={pdfBusy} accessibilityRole="button" accessibilityLabel={t("app_pdfForVet")} accessibilityState={{ busy: pdfBusy }}
            style={({ pressed }) => [...ghost(pressed), { flexGrow: 1, flexBasis: 140 }]}>
            {pdfBusy ? <ActivityIndicator color={C.link} /> : <><Icon name="share" size={16} /><Text style={S.btnGhostText}>{t("app_pdfForVet")}</Text></>}
          </Pressable>
        </View>
      </View>

      {/* My vet, when one is chosen: its state now, and Call */}
      {vet && (
        <View style={[S.card, S.row, { gap: 10, paddingVertical: 10, paddingRight: 8 }]}>
          <Pressable onPress={() => openVet(vet)} accessibilityRole="button" style={({ pressed }) => [{ flex: 1, gap: 1, minHeight: 44 }, pressed && S.pressed]}>
            <View style={[S.row, { gap: 5 }]}>
              <Icon name="home" size={14} color={C.muted} />
              <Text style={S.muted}>{t("app_myVet")}</Text>
            </View>
            <Text style={[S.body, { fontWeight: "700" }]}>{displayName(vet, t)}</Text>
            <OpenBadge p={vet} />
          </Pressable>
          {!!vet.phone && (
            <Pressable onPress={() => Linking.openURL(callUrl(vet.phone!)).catch(() => undefined)} accessibilityRole="button"
              accessibilityLabel={tf("app_callMyVet", { name: displayName(vet, t) })}
              style={({ pressed }) => [{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }, pressed && S.pressed]}>
              <Icon name="phone" size={20} color={C.onBrand} />
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}
