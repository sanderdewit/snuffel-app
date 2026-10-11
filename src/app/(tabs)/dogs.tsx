// My dogs: profiles with their next care reminder.
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { importData, NeedsPasswordError } from "../../lib/dogfile";
import { router, useFocusEffect } from "expo-router";
import { useI18n } from "../../i18n";
import { ageMonths, listDogs, listReminders, REMINDER_KINDS, today, type Dog, type Reminder } from "../../lib/dogs";
import { C, S } from "../../ui/theme";

type Row = Dog & { next: Reminder | null };

export default function Dogs() {
  const { t, tf } = useI18n();
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
    try { text = await new File(r.assets[0].uri).text(); } catch { Alert.alert(t("app_importFailed")); return; }
    await runImport(text, null);
  };

  const age = (d: Dog) => {
    const m = ageMonths(d.birth);
    if (m == null) return null;
    return m < 24 ? tf("app_ageMonths", { n: m }) : tf("app_age", { n: Math.floor(m / 12) });
  };

  return (
    <View style={S.screen}>
      <FlatList
        data={dogs}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={[S.body, { marginBottom: 12 }]}>🐕 {t("app_noDogs")}</Text>}
        renderItem={({ item: d }) => (
          <Pressable style={S.card} onPress={() => router.push({ pathname: "/dog/[id]", params: { id: String(d.id) } })} accessibilityRole="button">
            <View style={[S.row, { gap: 12 }]}>
              {d.photo
                ? <Image source={{ uri: d.photo }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                : <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.chip, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 28 }}>🐶</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={S.h2}>{d.name}</Text>
                <Text style={S.muted}>{[d.breed, age(d), d.weight ? d.weight + " kg" : null].filter(Boolean).join(" · ")}</Text>
                {d.next && (
                  <Text style={[S.muted, { color: d.next.due! < today() ? C.danger : C.text, marginTop: 2 }]}>
                    {t(REMINDER_KINDS.find((k) => k.kind === d.next!.kind)!.key)}: {d.next.due! < today() ? t("app_overdue") : tf("app_nextDue", { date: d.next.due! })}
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={{ gap: 8, marginTop: 6 }}>
            <Pressable style={S.btn} onPress={() => router.push({ pathname: "/dog/[id]", params: { id: "new" } })} accessibilityRole="button">
              <Text style={S.btnText}>＋ {t("app_addDog")}</Text>
            </Pressable>
            {asking ? (
              <View style={[S.card, { gap: 6 }]}>
                <Text style={S.body}>{t("app_importPassword")}</Text>
                <TextInput style={S.input} value={pw} onChangeText={setPw} placeholder={t("app_password")} secureTextEntry autoCapitalize="none" autoFocus />
                <View style={[S.row, { gap: 8 }]}>
                  <Pressable style={[S.btnGhost, { flex: 1 }]} onPress={() => { setAsking(null); setPw(""); }}><Text style={S.btnGhostText}>{t("app_cancel")}</Text></Pressable>
                  <Pressable style={[S.btn, { flex: 1 }]} onPress={() => runImport(asking, pw)}><Text style={S.btnText}>OK</Text></Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={S.btnGhost} onPress={pickImport} disabled={importing} accessibilityRole="button">
                {importing ? <ActivityIndicator color={C.brand} /> : <Text style={S.btnGhostText}>📥 {t("app_import")}</Text>}
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}
