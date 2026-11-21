// The dog's health & behaviour file. First what a vet asks first: the key facts
// (allergies, latest medication) and what keeps coming back. Then Add entry, filter
// chips by kind and the entries by month; an entry opens to read, edit or delete it
// (src/app/dog/entry/[id].tsx). The two AI settings sit behind one row
// (src/app/dog/ai/[id].tsx); the PDF for the vet is in the header.
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../../i18n";
import { getDog, type Dog } from "../../../lib/dogs";
import {
  autoFile, exportData, exportPdf, listRecords, PASSWORD_MIN, PasswordTooShortError, RECORD_KINDS, recurring, shareFileWithAi,
  type DogRecord, type RecordKind
} from "../../../lib/dogfile";
import { byMonth, formatDayMonth, formatMonth, keyFacts, kindsIn } from "../../../lib/dogfileview";
import { formatDate } from "../../../lib/dates";
import { HeaderButton } from "../../../ui/HeaderButton";
import { Icon } from "../../../ui/Icon";
import { Input } from "../../../ui/Input";
import { RecordDisc, RecordIcon } from "../../../ui/RecordIcon";
import { useTheme } from "../../../ui/theme";

const KIND_ORDER = RECORD_KINDS.map((k) => k.kind);

export default function DogFile() {
  const { t, tf, lang } = useI18n();
  const { C, S } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dogId = Number(id);
  const [dog, setDog] = useState<Dog | null>(null);
  const [records, setRecords] = useState<DogRecord[] | null>(null);
  const [share, setShare] = useState(true);
  const [auto, setAuto] = useState(true);
  const [filter, setFilter] = useState<RecordKind | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState<"pdf" | "data" | null>(null);

  const reload = useCallback(async () => {
    setDog(await getDog(dogId));
    setRecords(await listRecords(dogId));
    setShare(await shareFileWithAi(dogId));
    setAuto(await autoFile(dogId));
  }, [dogId]);
  useFocusEffect(useCallback(() => { reload().catch(() => undefined); }, [reload]));

  const all = records ?? [];
  const kinds = kindsIn(all, KIND_ORDER);
  const shown = filter && kinds.includes(filter) ? filter : null;   // a kind whose last entry was deleted: All again
  const sections = byMonth(shown ? all.filter((r) => r.kind === shown) : all)
    .map((g) => ({ key: g.month, title: formatMonth(g.month, lang), data: g.records }));
  const facts = keyFacts(all);
  const again = recurring(all);
  const kindLabel = (k: RecordKind) => t(RECORD_KINDS.find((x) => x.kind === k)!.key);
  const openEntry = (r: DogRecord) => router.push({ pathname: "/dog/entry/[id]", params: { id: String(r.id) } });
  const hair = StyleSheet.hairlineWidth;

  const doExport = async () => {
    if (pw && pw.length < PASSWORD_MIN) { Alert.alert(t("app_passwordTooShort")); return; }
    if (pw && pw !== pw2) { Alert.alert(t("app_passwordMismatch")); return; }
    setBusy("data");
    try { await exportData(dogId, pw || null); setExporting(false); setPw(""); setPw2(""); }
    catch (e) { Alert.alert(t(e instanceof PasswordTooShortError ? "app_passwordTooShort" : "app_actionFailed")); }
    finally { setBusy(null); }
  };
  const doPdf = async () => {
    setBusy("pdf");
    try { await exportPdf(dogId, t, tf, lang); } catch { Alert.alert(t("app_actionFailed")); } finally { setBusy(null); }
  };

  const fact = (r: DogRecord, label: string) => (
    <Pressable key={r.id} onPress={() => openEntry(r)} accessibilityRole="button"
      style={({ pressed }) => [S.row, { gap: 10, alignItems: "flex-start", minHeight: 44 }, pressed && S.pressed]}>
      <View style={{ marginTop: 2 }}><RecordIcon kind={r.kind} size={18} color={r.kind === "allergy" ? C.warn : C.muted} /></View>
      <View style={{ flex: 1 }}>
        <Text style={S.muted}>{label} · {formatDate(r.date, lang)}</Text>
        <Text style={[S.body, { fontWeight: "600" }]}>{r.title}</Text>
        {!!r.details && <Text style={[S.muted, { fontSize: 14, lineHeight: 20 }]} numberOfLines={2}>{r.details}</Text>}
      </View>
    </Pressable>
  );

  const filterChip = (k: RecordKind | null) => {
    const on = shown === k;
    return (
      <Pressable key={k ?? "all"} onPress={() => setFilter(k)} accessibilityRole="radio" accessibilityState={{ checked: on }}
        style={({ pressed }) => [{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: on ? C.brand : C.chip, justifyContent: "center" }, pressed && S.pressed]}>
        <Text style={{ fontSize: 15, color: on ? C.onBrand : C.text, fontWeight: on ? "600" : "400" }}>{k ? kindLabel(k) : t("filterAll")}</Text>
      </Pressable>
    );
  };

  const header = (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text style={S.h1} accessibilityRole="header">{t("app_dogFile")}</Text>
        <Text style={S.muted}>{records && !all.length ? t("app_dogFileIntro") : t("app_staysOnPhone")}</Text>
      </View>

      {/* Both AI settings in one row; they open on their own screen */}
      <Pressable onPress={() => router.push({ pathname: "/dog/ai/[id]", params: { id: String(dogId) } })} accessibilityRole="button"
        style={({ pressed }) => [S.card, S.row, { gap: 12, minHeight: 56, paddingVertical: 10, paddingRight: 10 }, pressed && S.pressed]}>
        <Icon name="message-circle" size={20} color={C.muted} />
        <View style={{ flex: 1 }}>
          <Text style={[S.body, { fontWeight: "600" }]}>{t(share ? "app_aiUsesFile" : "app_aiNotUsesFile")}</Text>
          <Text style={S.muted}>{t(auto ? "app_autoFileOn" : "app_autoFileOff")}</Text>
        </View>
        <Icon name="chevron-right" size={18} color={C.muted} />
      </Pressable>

      {(facts.allergies.length > 0 || !!facts.medication) && (
        <View style={[S.card, { gap: 8 }]}>
          {facts.allergies.map((r) => fact(r, t("app_rec_allergy")))}
          {facts.medication && fact(facts.medication, t("app_latestMedication"))}
        </View>
      )}

      {/* Signs that came back: the first thing a vet wants to know */}
      {again.length > 0 && (
        <View style={[S.card, { gap: 6, borderColor: C.warn, borderWidth: 1.5 }]}>
          <View style={[S.row, { gap: 8 }]}>
            <Icon name="repeat" size={20} color={C.warn} />
            <Text style={[S.h2, { flex: 1 }]} accessibilityRole="header">{t("app_recurring")}</Text>
          </View>
          {again.map((g) => (
            <Text key={g.category} style={S.body}>
              <Text style={{ fontWeight: "700" }}>{t("app_sign_" + g.category)}</Text> ({tf("app_recurringTimes", { n: g.dates.length })}): {g.dates.map((d) => formatDate(d, lang)).join(", ")}
            </Text>
          ))}
          <Text style={S.muted}>{t("app_recurringText")}</Text>
        </View>
      )}

      <Pressable onPress={() => router.push({ pathname: "/dog/entry/[id]", params: { id: "new", dog: String(dogId) } })} accessibilityRole="button"
        style={({ pressed }) => [S.btn, S.row, { gap: 8, minHeight: 48 }, pressed && S.pressed]}>
        <Icon name="plus" size={20} color={C.onBrand} />
        <Text style={S.btnText}>{t("app_addEntry")}</Text>
      </Pressable>

      {kinds.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
          accessibilityRole="radiogroup" accessibilityLabel={t("app_entryKind")}>
          {[null, ...kinds].map(filterChip)}
        </ScrollView>
      )}
    </View>
  );

  const footer = (
    <View style={[S.card, { gap: 8, marginTop: 24 }]}>
      {exporting ? (
        <View style={{ gap: 6 }}>
          <Text style={S.muted}>{t("app_exportPasswordHint")}</Text>
          <Input style={S.input} value={pw} onChangeText={setPw} placeholder={t("app_password")} accessibilityLabel={t("app_password")}
            secureTextEntry autoCapitalize="none" textContentType="newPassword" />
          {!!pw && <Input style={S.input} value={pw2} onChangeText={setPw2} placeholder={t("app_passwordRepeat")} accessibilityLabel={t("app_passwordRepeat")}
            secureTextEntry autoCapitalize="none" textContentType="newPassword" />}
          <View style={[S.row, { gap: 8 }]}>
            <Pressable onPress={() => { setExporting(false); setPw(""); setPw2(""); }} accessibilityRole="button"
              style={({ pressed }) => [S.btnGhost, { flex: 1, minHeight: 48 }, pressed && S.pressed]}>
              <Text style={S.btnGhostText}>{t("app_cancel")}</Text>
            </Pressable>
            <Pressable onPress={doExport} disabled={!!busy} accessibilityRole="button" style={({ pressed }) => [S.btn, { flex: 1, minHeight: 48 }, pressed && S.pressed]}>
              <Text style={S.btnText}>{t("app_export")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setExporting(true)} disabled={!!busy} accessibilityRole="button"
          style={({ pressed }) => [S.btnGhost, S.row, { gap: 6, minHeight: 44 }, pressed && S.pressed]}>
          <Icon name="upload" size={18} />
          <Text style={S.btnGhostText}>{t("app_exportData")}</Text>
        </Pressable>
      )}
      {busy === "data" && <View style={[S.row, { gap: 8, justifyContent: "center" }]}><ActivityIndicator color={C.link} /><Text style={S.muted}>{t("app_working")}</Text></View>}
    </View>
  );

  return (
    <View style={S.screen}>
      <Stack.Screen options={{
        title: dog ? dog.name : t("app_dogFile"),
        headerRight: () => <HeaderButton label={t("app_exportPdf")} icon="share" onPress={doPdf} busy={busy === "pdf"} disabled={!!busy} />
      }} />
      <SectionList
        sections={sections}
        keyExtractor={(r) => String(r.id)}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        initialNumToRender={20}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={records ? <Text style={[S.muted, { marginTop: 16 }]}>{t("app_noEntries")}</Text> : undefined}
        renderSectionHeader={({ section }) => (
          <Text style={[S.muted, { fontSize: 14, fontWeight: "700", marginTop: 18, marginBottom: 6 }]} accessibilityRole="header">{section.title}</Text>
        )}
        renderItem={({ item: r, index, section }) => {
          const first = index === 0, last = index === section.data.length - 1;
          const line = [kindLabel(r.kind), r.kind === "symptom" && r.category && r.category !== "other" ? t("app_sign_" + r.category) : null,
            formatDayMonth(r.date, lang)].filter(Boolean).join(" · ");
          return (
            <Pressable onPress={() => openEntry(r)} accessibilityRole="button"
              style={({ pressed }) => [{
                flexDirection: "row", gap: 12, alignItems: "flex-start", minHeight: 44, paddingVertical: 12, paddingLeft: 14, paddingRight: 10,
                backgroundColor: C.card, borderColor: C.line, borderLeftWidth: hair, borderRightWidth: hair, borderTopWidth: hair, borderBottomWidth: last ? hair : 0,
                borderTopLeftRadius: first ? 14 : 0, borderTopRightRadius: first ? 14 : 0, borderBottomLeftRadius: last ? 14 : 0, borderBottomRightRadius: last ? 14 : 0
              }, pressed && S.pressed]}>
              <RecordDisc kind={r.kind} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={S.muted}>{line}</Text>
                <Text style={[S.body, { fontWeight: "700" }]} numberOfLines={3}>{r.kind === "weight" && r.value != null ? `${r.value} kg` : r.title}</Text>
                {!!r.details && <Text style={[S.muted, { fontSize: 14, lineHeight: 20 }]} numberOfLines={2}>{r.details}</Text>}
              </View>
              <Icon name="chevron-right" size={18} color={C.muted} style={{ marginTop: 9 }} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
