// My dogs: profiles with their next care reminder. A dog opens its page
// (src/app/dog/[id].tsx); importing a dog (rare) is a quiet link under "Add a dog".
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { IMPORT_MAX_BYTES, importData, NeedsPasswordError } from "../../lib/dogfile";
import { router, useFocusEffect } from "expo-router";
import { useI18n } from "../../i18n";
import { listDogs, listReminders, REMINDER_KINDS, today, type Dog, type Reminder } from "../../lib/dogs";
import { breedLabel, breeds } from "../../lib/breeds";
import { DogAvatar } from "../../ui/DogAvatar";
import { ageText } from "../../ui/dogInfo";
import { Icon, Symbol } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { useTheme } from "../../ui/theme";
import { formatDate } from "../../lib/dates";

type Row = Dog & { next: Reminder | null };

export default function Dogs() {
  const { t, tf, lang } = useI18n();
  const { C, S } = useTheme();
  const [dogs, setDogs] = useState<Row[]>([]);
  const withNext = async (): Promise<Row[]> => {
    const out: Row[] = [];
    for (const d of await listDogs()) {
      const due = (await listReminders(d.id)).filter((r) => r.due).sort((a, b) => a.due!.localeCompare(b.due!));
      out.push({ ...d, next: due[0] || null });
    }
    return out;
  };
  useFocusEffect(useCallback(() => { withNext().then(setDogs).catch(() => undefined); }, []));

  // Import a dog from an export (another phone, or a backup). Encrypted files ask for the password.
  const [asking, setAsking] = useState<string | null>(null);   // the file text, while a password is needed
  const [pw, setPw] = useState("");
  const [importing, setImporting] = useState(false);
  const runImport = async (text: string, password: string | null) => {
    setImporting(true);
    try {
      const name = await importData(text, password);
      setAsking(null); setPw("");
      Alert.alert(tf("app_importDone", { name }));
      setDogs(await withNext());
    } catch (e) {
      if (e instanceof NeedsPasswordError) { if (password) Alert.alert(t("app_wrongPassword")); setAsking(text); }
      else { setAsking(null); Alert.alert(t("app_importFailed")); }
    } finally { setImporting(false); }
  };
  const pickImport = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    let text = "";
    try {
      // Size first: a huge file is refused before it is read into memory.
      const file = new File(r.assets[0].uri);
      const size = r.assets[0].size ?? file.size;
      if (!size || size > IMPORT_MAX_BYTES) { Alert.alert(t("app_importFailed")); return; }
      text = await file.text();
    } catch { Alert.alert(t("app_importFailed")); return; }
    await runImport(text, null);
  };

  return (
    <View style={S.screen}>
      <FlatList
        data={dogs}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <View style={[S.row, { gap: 10, alignItems: "flex-start", marginBottom: 12 }]}>
            <Symbol name="dog" size={22} color={C.muted} />
            <Text style={[S.body, { flex: 1 }]}>{t("app_noDogs")}</Text>
          </View>
        }
        renderItem={({ item: d }) => {
          const overdue = !!d.next && d.next.due! < today();
          return (
            <Pressable onPress={() => router.push({ pathname: "/dog/[id]", params: { id: String(d.id) } })} accessibilityRole="button"
              style={({ pressed }) => [S.card, pressed && S.pressed]}>
              <View style={[S.row, { gap: 12 }]}>
                <DogAvatar name={d.name} photo={d.photo} size={56} />
                <View style={{ flex: 1 }}>
                  <Text style={S.h2}>{d.name}</Text>
                  <Text style={S.muted}>{[breedLabel(breeds(), d, lang, t, tf), ageText(d, tf), d.weight ? d.weight + " kg" : null].filter(Boolean).join(" · ")}</Text>
                  {d.next && (
                    <Text style={[S.muted, { color: overdue ? C.danger : C.text, marginTop: 2 }, overdue && { fontWeight: "700" }]}>
                      {t(REMINDER_KINDS.find((k) => k.kind === d.next!.kind)!.key)}: {overdue ? t("app_overdue") : tf("app_nextDue", { date: formatDate(d.next.due!, lang) })}
                    </Text>
                  )}
                </View>
                <Icon name="chevron-right" size={18} color={C.muted} />
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={{ gap: 8, marginTop: 6 }}>
            <Pressable onPress={() => router.push({ pathname: "/dog/[id]", params: { id: "new" } })} accessibilityRole="button"
              style={({ pressed }) => [S.btn, S.row, { gap: 8, minHeight: 48 }, pressed && S.pressed]}>
              <Icon name="plus" size={20} color={C.onBrand} />
              <Text style={S.btnText}>{t("app_addDog")}</Text>
            </Pressable>
            {asking ? (
              <View style={[S.card, { gap: 6 }]}>
                <Text style={S.body}>{t("app_importPassword")}</Text>
                <Input style={S.input} value={pw} onChangeText={setPw} placeholder={t("app_password")} accessibilityLabel={t("app_password")}
                  secureTextEntry autoCapitalize="none" autoFocus />
                <View style={[S.row, { gap: 8 }]}>
                  <Pressable onPress={() => { setAsking(null); setPw(""); }} accessibilityRole="button"
                    style={({ pressed }) => [S.btnGhost, { flex: 1, minHeight: 44 }, pressed && S.pressed]}>
                    <Text style={S.btnGhostText}>{t("app_cancel")}</Text>
                  </Pressable>
                  <Pressable onPress={() => runImport(asking, pw)} disabled={importing} accessibilityRole="button"
                    style={({ pressed }) => [S.btn, { flex: 1, minHeight: 44 }, pressed && S.pressed]}>
                    {importing ? <ActivityIndicator color={C.onBrand} /> : <Text style={S.btnText}>OK</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              // Rare, so a quiet link instead of a second big button. Link colour: brand on the chip is 2.7:1 in dark.
              <Pressable onPress={pickImport} disabled={importing} accessibilityRole="button" accessibilityLabel={t("app_import")} accessibilityState={{ busy: importing }}
                style={({ pressed }) => [S.row, { gap: 6, minHeight: 44, justifyContent: "center" }, pressed && S.pressed]}>
                {importing ? <ActivityIndicator color={C.link} /> : (
                  <>
                    <Icon name="download" size={18} color={C.link} />
                    <Text style={{ color: C.link, fontSize: 15, fontWeight: "600" }}>{t("app_import")}</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}
