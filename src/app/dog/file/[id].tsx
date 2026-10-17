// The dog's health & behaviour file: entries, AI sharing switch, export.
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../../i18n";
import { getDog, today, validDate, type Dog } from "../../../lib/dogs";
import {
  addRecord, deleteRecord, exportData, exportPdf, listRecords, PASSWORD_MIN, PasswordTooShortError, RECORD_KINDS, setShareFileWithAi, shareFileWithAi,
  type DogRecord, type RecordKind
} from "../../../lib/dogfile";
import { Toggle } from "../../../ui/Toggle";
import { C, S } from "../../../ui/theme";
import { DateField } from "../../../ui/DateField";
import { formatDate } from "../../../lib/dates";

export default function DogFile() {
  const { t, tf, lang } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dogId = Number(id);
  const [dog, setDog] = useState<Dog | null>(null);
  const [records, setRecords] = useState<DogRecord[]>([]);
  const [share, setShare] = useState(true);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<RecordKind>("visit");
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [weight, setWeight] = useState("");
  const [exporting, setExporting] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setDog(await getDog(dogId));
    setRecords(await listRecords(dogId));
    setShare(await shareFileWithAi(dogId));
  }, [dogId]);
  useFocusEffect(useCallback(() => { reload().catch(() => undefined); }, [reload]));

  const kindLabel = (k: RecordKind) => t(RECORD_KINDS.find((x) => x.kind === k)!.key);
  const icon = (k: RecordKind) => RECORD_KINDS.find((x) => x.kind === k)!.icon;

  const save = async () => {
    if (!validDate(date)) { Alert.alert(t("app_invalidDate")); return; }
    const kg = kind === "weight" ? Number(weight.replace(",", ".")) : null;
    if (kind === "weight" && !(kg! > 0 && kg! < 150)) { Alert.alert(t("app_entryWeight")); return; }
    const what = kind === "weight" ? t("app_rec_weight") : title.trim();
    if (!what) { Alert.alert(t("app_entryTitle")); return; }
    await addRecord({ dogId, kind, date, title: what, details: details.trim() || null, value: kg });
    setAdding(false); setTitle(""); setDetails(""); setWeight(""); setDate(today());
    await reload();
  };

  const remove = (r: DogRecord) => Alert.alert(t("app_deleteEntryConfirm"), r.title, [
    { text: t("app_cancel"), style: "cancel" },
    { text: t("app_delete"), style: "destructive", onPress: async () => { await deleteRecord(r); await reload(); } }
  ]);

  const doExport = async () => {
    if (pw && pw.length < PASSWORD_MIN) { Alert.alert(t("app_passwordTooShort")); return; }
    if (pw && pw !== pw2) { Alert.alert(t("app_passwordMismatch")); return; }
    setBusy(true);
    try { await exportData(dogId, pw || null); setExporting(false); setPw(""); setPw2(""); }
    catch (e) { Alert.alert(t(e instanceof PasswordTooShortError ? "app_passwordTooShort" : "app_errLoad")); }
    finally { setBusy(false); }
  };
  const doPdf = async () => {
    setBusy(true);
    try { await exportPdf(dogId, t, tf); } catch { Alert.alert(t("app_errLoad")); } finally { setBusy(false); }
  };

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: dog ? dog.name : t("app_dogFile") }} />
      <Text style={S.h1}>📁 {t("app_dogFile")}</Text>
      <Text style={S.muted}>{t("app_dogFileIntro")}</Text>

      <View style={[S.card, { gap: 6 }]}>
        <View style={[S.row, { justifyContent: "space-between", gap: 10 }]}>
          <Text style={[S.h2, { flex: 1 }]}>💬 {t("app_shareWithAi")}</Text>
          <Toggle value={share} label={t("app_shareWithAi")} onValueChange={async (v) => { setShare(v); await setShareFileWithAi(dogId, v); }} />
        </View>
        <Text style={S.muted}>{t("app_shareWithAiText")}</Text>
      </View>

      {adding ? (
        <View style={[S.card, { gap: 8 }]}>
          <Text style={S.muted}>{t("app_entryKind")}</Text>
          <View style={[S.row, { flexWrap: "wrap", gap: 6 }]}>
            {RECORD_KINDS.filter((k) => k.kind !== "ai").map((k) => (
              <Pressable key={k.kind} onPress={() => setKind(k.kind)}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: kind === k.kind ? C.brand : C.chip }}>
                <Text style={{ color: kind === k.kind ? "#fff" : C.text }}>{k.icon} {t(k.key)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={S.muted}>{t("app_entryDate")}</Text>
          <DateField value={date} onChange={setDate} maximumDate={new Date()} accessibilityLabel={t("app_entryDate")} />
          {kind === "weight" ? (
            <>
              <Text style={S.muted}>{t("app_entryWeight")}</Text>
              <TextInput style={S.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} autoFocus />
            </>
          ) : (
            <>
              <Text style={S.muted}>{t("app_entryTitle")}</Text>
              <TextInput style={S.input} value={title} onChangeText={setTitle} maxLength={200} autoFocus />
            </>
          )}
          <Text style={S.muted}>{t("app_entryDetails")}</Text>
          <TextInput style={[S.input, { minHeight: 70, textAlignVertical: "top" }]} value={details} onChangeText={setDetails} multiline maxLength={4000} />
          <View style={[S.row, { gap: 8 }]}>
            <Pressable style={[S.btnGhost, { flex: 1 }]} onPress={() => setAdding(false)}><Text style={S.btnGhostText}>{t("app_cancel")}</Text></Pressable>
            <Pressable style={[S.btn, { flex: 1 }]} onPress={save}><Text style={S.btnText}>{t("app_save")}</Text></Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={S.btn} onPress={() => setAdding(true)} accessibilityRole="button"><Text style={S.btnText}>＋ {t("app_addEntry")}</Text></Pressable>
      )}

      {records.length === 0 && !adding && <Text style={S.muted}>{t("app_noEntries")}</Text>}
      {records.map((r) => (
        <Pressable key={r.id} onLongPress={() => remove(r)} style={[S.card, { gap: 4 }]}>
          <View style={[S.row, { justifyContent: "space-between" }]}>
            <Text style={S.muted}>{icon(r.kind)} {kindLabel(r.kind)} · {formatDate(r.date, lang)}</Text>
            <Pressable onPress={() => remove(r)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("app_delete")}>
              <Text style={{ color: C.muted }}>✕</Text>
            </Pressable>
          </View>
          <Text style={S.h2}>{r.kind === "weight" && r.value ? `${r.value} kg` : r.title}</Text>
          {!!r.details && <Text style={S.body} numberOfLines={r.kind === "ai" ? 4 : undefined}>{r.details}</Text>}
        </Pressable>
      ))}

      <View style={[S.card, { gap: 8, marginTop: 8 }]}>
        <Pressable style={S.btnGhost} onPress={doPdf} disabled={busy}><Text style={S.btnGhostText}>📄 {t("app_exportPdf")}</Text></Pressable>
        {exporting ? (
          <View style={{ gap: 6 }}>
            <Text style={S.muted}>{t("app_exportPasswordHint")}</Text>
            <TextInput style={S.input} value={pw} onChangeText={setPw} placeholder={t("app_password")} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
            {!!pw && <TextInput style={S.input} value={pw2} onChangeText={setPw2} placeholder={t("app_passwordRepeat")} secureTextEntry autoCapitalize="none" textContentType="newPassword" />}
            <Pressable style={S.btn} onPress={doExport} disabled={busy}><Text style={S.btnText}>{t("app_export")}</Text></Pressable>
          </View>
        ) : (
          <Pressable style={S.btnGhost} onPress={() => setExporting(true)} disabled={busy}><Text style={S.btnGhostText}>📤 {t("app_exportData")}</Text></Pressable>
        )}
        {busy && <View style={[S.row, { gap: 8, justifyContent: "center" }]}><ActivityIndicator color={C.brand} /><Text style={S.muted}>{t("app_working")}</Text></View>}
      </View>
    </ScrollView>
  );
}
