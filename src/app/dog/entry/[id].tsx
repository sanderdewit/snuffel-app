// One entry of the health file: read it, Edit it (Save), or Delete it (with a
// confirmation). With id "new" and ?dog= it is the form to add an entry. The checks
// are the ones the add form always had; a sign also gets its kind (vomiting, skin…),
// so signs added by hand count for "Keeps coming back" too.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../../i18n";
import { getDog, today, validDate } from "../../../lib/dogs";
import { addRecord, deleteRecord, getRecord, RECORD_KINDS, updateRecord, type DogRecord, type RecordKind } from "../../../lib/dogfile";
import { SIGN_CATEGORIES, signCategory, type SignCategory } from "../../../lib/dogsummary";
import { formatDate } from "../../../lib/dates";
import { DateField } from "../../../ui/DateField";
import { HeaderButton } from "../../../ui/HeaderButton";
import { Icon } from "../../../ui/Icon";
import { Input } from "../../../ui/Input";
import { RecordDisc, RecordIcon } from "../../../ui/RecordIcon";
import { useTheme } from "../../../ui/theme";

export default function Entry() {
  const { t, lang } = useI18n();
  const { C, S } = useTheme();
  const params = useLocalSearchParams<{ id: string; dog?: string }>();
  const isNew = params.id === "new";
  const newFor = Number(params.dog);
  const [rec, setRec] = useState<DogRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(isNew);
  const [kind, setKind] = useState<RecordKind>("visit");
  const [category, setCategory] = useState<SignCategory>("other");
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  const load = useCallback(async () => {
    if (isNew) {   // only for a dog that exists
      if (!(Number.isInteger(newFor) && newFor > 0) || !(await getDog(newFor))) setMissing(true);
      return;
    }
    const r = await getRecord(Number(params.id));
    if (r) setRec(r); else setMissing(true);
  }, [isNew, newFor, params.id]);
  useEffect(() => { load().catch(() => setMissing(true)); }, [load]);
  useEffect(() => { if (missing && router.canGoBack()) router.back(); }, [missing]);

  const kindLabel = (k: RecordKind) => t(RECORD_KINDS.find((x) => x.kind === k)?.key ?? "app_rec_note");
  const kindLine = (r: DogRecord) => kindLabel(r.kind) + (r.kind === "symptom" && r.category && r.category !== "other" ? " · " + t("app_sign_" + r.category) : "");

  const startEdit = (r: DogRecord) => {
    setKind(r.kind); setCategory(signCategory(r.category)); setDate(r.date);
    setTitle(r.kind === "weight" ? "" : r.title); setDetails(r.details || ""); setWeight(r.value != null ? String(r.value) : "");
    setEditing(true);
  };

  const save = async () => {
    if (lock.current) return;
    if (!validDate(date)) { Alert.alert(t("app_invalidDate")); return; }
    const kg = kind === "weight" ? Number(weight.replace(",", ".")) : null;
    if (kind === "weight" && !(kg! > 0 && kg! < 150)) { Alert.alert(t("app_entryWeight")); return; }
    const what = kind === "weight" ? t("app_rec_weight") : title.trim();
    if (!what) { Alert.alert(t("app_entryTitle")); return; }
    const fields = { kind, date, title: what, details: details.trim() || null, value: kg, category: kind === "symptom" ? category : null };
    lock.current = true; setSaving(true);
    try {
      if (isNew) { await addRecord({ dogId: newFor, ...fields }); router.back(); return; }
      if (!rec) return;
      if (!(await updateRecord({ ...rec, ...fields }))) { setMissing(true); return; }
      setRec(await getRecord(rec.id));
      setEditing(false);
    } catch {
      Alert.alert(t("app_actionFailed"));
    } finally { lock.current = false; setSaving(false); }
  };

  const cancel = () => { if (isNew) router.back(); else setEditing(false); };

  const remove = (r: DogRecord) => Alert.alert(t("app_deleteEntryConfirm"), r.title, [
    { text: t("app_cancel"), style: "cancel" },
    { text: t("app_delete"), style: "destructive", onPress: async () => {
      try { await deleteRecord(r); router.back(); } catch { Alert.alert(t("app_actionFailed")); }
    } }
  ]);

  const chip = (on: boolean, label: string, onPress: () => void, icon?: RecordKind) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }}
      style={({ pressed }) => [{ minHeight: 44, paddingHorizontal: 12, borderRadius: 22, backgroundColor: on ? C.brand : C.chip, flexDirection: "row", alignItems: "center", gap: 6 }, pressed && S.pressed]}>
      {icon && <RecordIcon kind={icon} size={16} color={on ? C.onBrand : C.muted} />}
      <Text style={{ fontSize: 15, color: on ? C.onBrand : C.text, fontWeight: on ? "600" : "400" }}>{label}</Text>
    </Pressable>
  );

  if (missing) return <View style={S.screen}><Stack.Screen options={{ title: "" }} /></View>;
  if (!isNew && !rec) return <View style={S.screen}><Stack.Screen options={{ title: "" }} /></View>;

  // ---- reading an entry ----
  if (!editing && rec) {
    return (
      <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <Stack.Screen options={{ title: kindLabel(rec.kind), headerRight: () => <HeaderButton label={t("app_edit")} onPress={() => startEdit(rec)} /> }} />
        <View style={[S.card, { gap: 10 }]}>
          <View style={[S.row, { gap: 10 }]}>
            <RecordDisc kind={rec.kind} />
            <View style={{ flex: 1 }}>
              <Text style={S.muted}>{kindLine(rec)}</Text>
              <Text style={S.body}>{formatDate(rec.date, lang)}</Text>
            </View>
          </View>
          <Text style={S.h1} selectable>{rec.kind === "weight" && rec.value != null ? `${rec.value} kg` : rec.title}</Text>
          {!!rec.details && <Text style={S.body} selectable>{rec.details}</Text>}
        </View>
        <Pressable onPress={() => remove(rec)} accessibilityRole="button"
          style={({ pressed }) => [S.btnGhost, S.row, { gap: 6, minHeight: 44, marginTop: 4 }, pressed && S.pressed]}>
          <Icon name="trash-2" size={18} color={C.danger} />
          <Text style={[S.btnGhostText, { color: C.danger }]}>{t("app_delete")}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ---- adding or editing ----
  const kinds = RECORD_KINDS.filter((k) => k.kind !== "ai" || rec?.kind === "ai");   // AI advice is saved from the chat only
  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: isNew ? t("app_addEntry") : kindLabel(rec!.kind), headerRight: () => null }} />
      <View style={[S.card, { gap: 10 }]}>
        <Text style={S.muted}>{t("app_entryKind")}</Text>
        <View style={[S.row, { flexWrap: "wrap", gap: 6 }]} accessibilityRole="radiogroup" accessibilityLabel={t("app_entryKind")}>
          {kinds.map((k) => chip(kind === k.kind, t(k.key), () => setKind(k.kind), k.kind))}
        </View>
        {kind === "symptom" && (
          <>
            <Text style={S.muted}>{t("app_entryCategory")}</Text>
            <View style={[S.row, { flexWrap: "wrap", gap: 6 }]} accessibilityRole="radiogroup" accessibilityLabel={t("app_entryCategory")}>
              {SIGN_CATEGORIES.map((c) => chip(category === c, t("app_sign_" + c), () => setCategory(c)))}
            </View>
          </>
        )}
        <Text style={S.muted}>{t("app_entryDate")}</Text>
        <DateField value={date} onChange={setDate} maximumDate={new Date()} accessibilityLabel={t("app_entryDate")} />
        {kind === "weight" ? (
          <>
            <Text style={S.muted}>{t("app_entryWeight")}</Text>
            <Input style={S.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} autoFocus={isNew} accessibilityLabel={t("app_entryWeight")} />
          </>
        ) : (
          <>
            <Text style={S.muted}>{t("app_entryTitle")}</Text>
            <Input style={S.input} value={title} onChangeText={setTitle} maxLength={200} autoFocus={isNew} accessibilityLabel={t("app_entryTitle")} />
          </>
        )}
        <Text style={S.muted}>{t("app_entryDetails")}</Text>
        <Input style={[S.input, { minHeight: 90, textAlignVertical: "top" }]} value={details} onChangeText={setDetails} multiline maxLength={4000} accessibilityLabel={t("app_entryDetails")} />
        <View style={[S.row, { gap: 8, marginTop: 4 }]}>
          <Pressable onPress={cancel} accessibilityRole="button" style={({ pressed }) => [S.btnGhost, { flex: 1, minHeight: 48 }, pressed && S.pressed]}>
            <Text style={S.btnGhostText}>{t("app_cancel")}</Text>
          </Pressable>
          <Pressable onPress={save} disabled={saving} accessibilityRole="button" accessibilityState={{ busy: saving, disabled: saving }}
            style={({ pressed }) => [S.btn, { flex: 1, minHeight: 48 }, pressed && S.pressed]}>
            {saving ? <ActivityIndicator color={C.onBrand} /> : <Text style={S.btnText}>{t("app_save")}</Text>}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
