// Add / edit a dog, and its care reminders.
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { useI18n } from "../../i18n";
import {
  deleteDog, getDog, listReminders, markDone, notificationsAllowed, REMINDER_KINDS, saveDog, setReminder, today, validDate,
  type Reminder, type ReminderKind
} from "../../lib/dogs";
import { Toggle } from "../../ui/Toggle";
import { C, S } from "../../ui/theme";

export default function DogScreen() {
  const { t, tf } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dogId, setDogId] = useState<number | null>(id && id !== "new" ? Number(id) : null);
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birth, setBirth] = useState("");
  const [weight, setWeight] = useState("");
  const [sex, setSex] = useState<"male" | "female" | null>(null);
  const [neutered, setNeutered] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [editing, setEditing] = useState<ReminderKind | null>(null);
  const [dateText, setDateText] = useState("");
  const [notifOff, setNotifOff] = useState(false);

  useEffect(() => {
    if (!dogId) return;
    getDog(dogId).then((d) => {
      if (!d) return;
      setName(d.name); setBreed(d.breed || ""); setBirth(d.birth || ""); setWeight(d.weight != null ? String(d.weight) : "");
      setSex(d.sex); setNeutered(!!d.neutered); setPhoto(d.photo);
    });
    listReminders(dogId).then(setReminders);
  }, [dogId]);

  const persist = async (): Promise<number | null> => {
    if (!name.trim()) { Alert.alert(t("app_nameRequired")); return null; }
    if (birth && !validDate(birth)) { Alert.alert(t("app_invalidDate")); return null; }
    const kg = weight ? Number(weight.replace(",", ".")) : null;
    const newId = await saveDog({ id: dogId ?? undefined, name, breed: breed.trim() || null, birth: birth || null,
      weight: kg != null && kg > 0 && kg < 150 ? kg : null, sex, neutered: sex ? neutered : null, photo });
    setDogId(newId);
    return newId;
  };

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (r.canceled || !r.assets[0]) return;
    // Copy out of the picker's temporary cache so the photo survives.
    const dest = new File(Paths.document, `dog-${Date.now()}.jpg`);
    await new File(r.assets[0].uri).copy(dest);
    if (photo) { try { new File(photo).delete(); } catch { /* already gone */ } }
    setPhoto(dest.uri);
  };

  const saveReminder = async (kind: ReminderKind, due: string | null) => {
    if (due && !validDate(due)) { Alert.alert(t("app_invalidDate")); return; }
    const idNow = dogId ?? (await persist());
    if (!idNow) return;
    if (due) setNotifOff(!(await notificationsAllowed(true)));
    await setReminder(idNow, kind, due);
    setReminders(await listReminders(idNow));
    setEditing(null);
  };

  const remove = () => Alert.alert(tf("app_deleteDogConfirm", { name }), undefined, [
    { text: t("app_cancel"), style: "cancel" },
    { text: t("app_delete"), style: "destructive", onPress: async () => {
      if (dogId) await deleteDog(dogId);
      if (photo) { try { new File(photo).delete(); } catch { /* ignore */ } }
      router.back();
    } }
  ]);

  const field = (label: string, el: React.ReactNode) => (
    <View style={{ gap: 4 }}><Text style={S.muted}>{label}</Text>{el}</View>
  );

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={pickPhoto} style={{ alignSelf: "center", alignItems: "center", gap: 6 }} accessibilityRole="button">
        {photo
          ? <Image source={{ uri: photo }} style={{ width: 110, height: 110, borderRadius: 55 }} />
          : <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: C.chip, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 48 }}>🐶</Text></View>}
        <Text style={{ color: C.brandDark, fontWeight: "600" }}>{t("app_choosePhoto")}</Text>
      </Pressable>

      {field(t("app_dogName"), <TextInput style={S.input} value={name} onChangeText={setName} maxLength={40} />)}
      {field(t("app_breed"), <TextInput style={S.input} value={breed} onChangeText={setBreed} maxLength={40} />)}
      {field(t("app_birthDate"), <TextInput style={S.input} value={birth} onChangeText={setBirth} placeholder="2021-04-30" keyboardType="numbers-and-punctuation" maxLength={10} />)}
      {field(t("app_weight"), <TextInput style={S.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} />)}
      {field(t("app_sex"), (
        <View style={[S.row, { gap: 8 }]}>
          {(["male", "female"] as const).map((s) => (
            <Pressable key={s} onPress={() => setSex(sex === s ? null : s)} style={[S.btnGhost, { flex: 1, backgroundColor: sex === s ? C.brand : C.chip }]}>
              <Text style={[S.btnGhostText, { color: sex === s ? "#fff" : C.text }]}>{t(s === "male" ? "app_male" : "app_female")}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      {sex && (
        <View style={[S.row, { justifyContent: "space-between" }]}>
          <Text style={S.body}>{t("app_neutered")}</Text>
          <Toggle value={neutered} onValueChange={setNeutered} />
        </View>
      )}
      <Pressable style={S.btn} onPress={async () => { if (await persist()) router.back(); }} accessibilityRole="button">
        <Text style={S.btnText}>{t("app_done")}</Text>
      </Pressable>

      <Text style={[S.h2, { marginTop: 8 }]}>⏰ {t("app_reminders")}</Text>
      {notifOff && <Text style={[S.muted, { color: C.warn }]}>{t("app_notifDenied")}</Text>}
      {REMINDER_KINDS.map((k) => {
        const r = reminders.find((x) => x.kind === k.kind);
        const overdue = !!(r && r.due && r.due < today());
        return (
          <View key={k.kind} style={[S.card, { gap: 6 }]}>
            <View style={[S.row, { justifyContent: "space-between" }]}>
              <Text style={S.h2}>{t(k.key)}</Text>
              <Text style={S.muted}>{tf("app_every", { n: r ? r.everyMonths : k.everyMonths })}</Text>
            </View>
            <Text style={[S.body, overdue && { color: C.danger, fontWeight: "700" }]}>
              {r && r.due ? (overdue ? t("app_overdue") + " · " + r.due : tf("app_nextDue", { date: r.due })) : t("app_notSet")}
            </Text>
            {editing === k.kind ? (
              <View style={[S.row, { gap: 8 }]}>
                <TextInput style={[S.input, { flex: 1 }]} value={dateText} onChangeText={setDateText} placeholder="2026-12-01" keyboardType="numbers-and-punctuation" maxLength={10} autoFocus />
                <Pressable style={S.btn} onPress={() => saveReminder(k.kind, dateText)}><Text style={S.btnText}>OK</Text></Pressable>
              </View>
            ) : (
              <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
                {r && r.due && (
                  <Pressable style={S.btnGhost} onPress={async () => { await markDone(r); setReminders(await listReminders(r.dogId)); }}>
                    <Text style={S.btnGhostText}>✓ {t("app_markDone")}</Text>
                  </Pressable>
                )}
                <Pressable style={S.btnGhost} onPress={() => { setEditing(k.kind); setDateText(r?.due || ""); }}>
                  <Text style={S.btnGhostText}>📅 {t("app_setDate")}</Text>
                </Pressable>
                {r && r.due && (
                  <Pressable style={S.btnGhost} onPress={() => saveReminder(k.kind, null)}>
                    <Text style={S.btnGhostText}>{t("app_remove")}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        );
      })}

      {dogId != null && (
        <Pressable onPress={remove} style={[S.btnGhost, { marginTop: 12 }]} accessibilityRole="button">
          <Text style={[S.btnGhostText, { color: C.danger }]}>{t("app_delete")}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
