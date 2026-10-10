// My dogs: profiles with their next care reminder.
import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useI18n } from "../../i18n";
import { ageMonths, listDogs, listReminders, REMINDER_KINDS, today, type Dog, type Reminder } from "../../lib/dogs";
import { C, S } from "../../ui/theme";

type Row = Dog & { next: Reminder | null };

export default function Dogs() {
  const { t, tf } = useI18n();
  const [dogs, setDogs] = useState<Row[]>([]);
  useFocusEffect(useCallback(() => {
    (async () => {
      const out: Row[] = [];
      for (const d of await listDogs()) {
        const due = (await listReminders(d.id)).filter((r) => r.due).sort((a, b) => a.due!.localeCompare(b.due!));
        out.push({ ...d, next: due[0] || null });
      }
      setDogs(out);
    })().catch(() => undefined);
  }, []));

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
          <Pressable style={[S.btn, { marginTop: 6 }]} onPress={() => router.push({ pathname: "/dog/[id]", params: { id: "new" } })} accessibilityRole="button">
            <Text style={S.btnText}>＋ {t("app_addDog")}</Text>
          </Pressable>
        }
      />
    </View>
  );
}
