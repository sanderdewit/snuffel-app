// The form of a dog's profile: photo, name, breed, birth date, weight, sex. To add a
// dog (src/app/dog/[id].tsx with id "new") and to edit one (src/app/dog/edit/[id].tsx).
// Nothing is stored until Done (the checks are the same as before). A new photo
// replaces the stored one only when Done saves it: a photo picked and then left
// without Done is removed again, and the old photo is removed once the new one is saved.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { File } from "expo-file-system";
import { useI18n } from "../i18n";
import { pickDogPhoto } from "../lib/photo";
import { deleteDog, getDog, saveDog, validDate } from "../lib/dogs";
import type { BreedChoice } from "../lib/breeds";
import { BreedPicker, NO_BREED } from "./BreedPicker";
import { DateField } from "./DateField";
import { DogAvatar } from "./DogAvatar";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { Toggle } from "./Toggle";
import { useTheme } from "./theme";

const removeFile = (uri: string | null) => { if (uri) { try { new File(uri).delete(); } catch { /* already gone */ } } };

export function DogForm({ dogId, onSaved, onDeleted }: { dogId: number | null; onSaved: (id: number) => void; onDeleted?: () => void }) {
  const { t, tf } = useI18n();
  const { C, S } = useTheme();
  const [loaded, setLoaded] = useState(dogId == null);
  const [name, setName] = useState("");
  const [breed, setBreed] = useState<BreedChoice>(NO_BREED);
  const [birth, setBirth] = useState("");
  const [weight, setWeight] = useState("");
  const [sex, setSex] = useState<"male" | "female" | null>(null);
  const [neutered, setNeutered] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stored = useRef<string | null>(null);   // the photo in the database
  const shown = useRef<string | null>(null);    // the photo on screen (maybe picked, not saved yet)
  const mounted = useRef(true);
  const saving = useRef(false);
  const show = (uri: string | null) => { shown.current = uri; setPhoto(uri); };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (shown.current !== stored.current) removeFile(shown.current);   // picked, never saved
    };
  }, []);

  useEffect(() => {
    if (dogId == null) return;
    let live = true;
    getDog(dogId).then((d) => {
      if (!live || !d) return;
      setName(d.name); setBreed({ breedId: d.breedId, breed: d.breed, breedSize: d.breedSize, breedMix: d.breedMix });
      setBirth(d.birth || ""); setWeight(d.weight != null ? String(d.weight) : "");
      setSex(d.sex); setNeutered(!!d.neutered);
      stored.current = d.photo; show(d.photo);
      setLoaded(true);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [dogId]);

  const pickPhoto = async () => {
    const picked = await pickDogPhoto().catch(() => null);   // 512 px, in the app's own storage
    if (!picked) return;
    if (!mounted.current) { removeFile(picked); return; }
    if (shown.current !== stored.current) removeFile(shown.current);   // an earlier pick, never saved
    show(picked);
  };

  const done = async () => {
    if (saving.current) return;
    if (!name.trim()) { Alert.alert(t("app_nameRequired")); return; }
    if (birth && !validDate(birth)) { Alert.alert(t("app_invalidDate")); return; }
    const kg = weight ? Number(weight.replace(",", ".")) : null;
    saving.current = true; setBusy(true);
    try {
      const id = await saveDog({ id: dogId ?? undefined, name, ...breed, birth: birth || null,
        weight: kg != null && kg > 0 && kg < 150 ? kg : null, sex, neutered: sex ? neutered : null, photo });
      // The new photo is in the database: now the old one can go.
      if (stored.current && stored.current !== photo) removeFile(stored.current);
      stored.current = photo;
      onSaved(id);
    } catch {
      Alert.alert(t("app_actionFailed"));
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const remove = () => Alert.alert(tf("app_deleteDogConfirm", { name: name.trim() }), undefined, [
    { text: t("app_cancel"), style: "cancel" },
    { text: t("app_delete"), style: "destructive", onPress: async () => {
      if (dogId == null) return;
      try { await deleteDog(dogId); } catch { Alert.alert(t("app_actionFailed")); return; }
      removeFile(stored.current);
      if (shown.current !== stored.current) removeFile(shown.current);
      stored.current = shown.current = null;
      onDeleted?.();
    } }
  ]);

  const field = (label: string, el: ReactNode) => (
    <View style={{ gap: 4 }}><Text style={S.muted}>{label}</Text>{el}</View>
  );

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={t("app_choosePhoto")}
        style={({ pressed }) => [{ alignSelf: "center", alignItems: "center", gap: 6, padding: 4 }, pressed && S.pressed]}>
        <DogAvatar name={name} photo={photo} size={110} />
        <View style={[S.row, { gap: 6, minHeight: 32 }]}>
          <Icon name="camera" size={16} color={C.link} />
          <Text style={{ color: C.link, fontWeight: "600", fontSize: 15 }}>{t("app_choosePhoto")}</Text>
        </View>
      </Pressable>

      {field(t("app_dogName"), <Input style={S.input} value={name} onChangeText={setName} maxLength={40} accessibilityLabel={t("app_dogName")} />)}
      {field(t("app_breed"), <BreedPicker value={breed} onChange={setBreed} />)}
      {field(t("app_birthDate"), <DateField value={birth} onChange={setBirth} maximumDate={new Date()} accessibilityLabel={t("app_birthDate")} />)}
      {field(t("app_weight"), <Input style={S.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} accessibilityLabel={t("app_weight")} />)}
      {field(t("app_sex"), (
        <View style={[S.row, { gap: 8 }]} accessibilityRole="radiogroup" accessibilityLabel={t("app_sex")}>
          {(["male", "female"] as const).map((s) => {
            const on = sex === s;
            return (
              <Pressable key={s} onPress={() => setSex(on ? null : s)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={({ pressed }) => [S.btnGhost, { flex: 1, minHeight: 44, backgroundColor: on ? C.brand : C.chip }, pressed && S.pressed]}>
                <Text style={[S.btnGhostText, { color: on ? C.onBrand : C.text }]}>{t(s === "male" ? "app_male" : "app_female")}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      {sex && (
        <View style={[S.row, { justifyContent: "space-between", gap: 10, minHeight: 44 }]}>
          <Text style={[S.body, { flex: 1 }]}>{t("app_neutered")}</Text>
          <Toggle value={neutered} onValueChange={setNeutered} label={t("app_neutered")} />
        </View>
      )}

      <Pressable onPress={done} disabled={!loaded || busy} accessibilityRole="button" accessibilityState={{ disabled: !loaded || busy, busy }}
        style={({ pressed }) => [S.btn, { minHeight: 48, marginTop: 4 }, (pressed || !loaded) && S.pressed]}>
        {busy ? <ActivityIndicator color={C.onBrand} /> : <Text style={S.btnText}>{t("app_done")}</Text>}
      </Pressable>

      {dogId != null && loaded && (
        <Pressable onPress={remove} accessibilityRole="button" style={({ pressed }) => [S.btnGhost, S.row, { gap: 6, minHeight: 44, marginTop: 12 }, pressed && S.pressed]}>
          <Icon name="trash-2" size={18} color={C.danger} />
          <Text style={[S.btnGhostText, { color: C.danger }]}>{t("app_delete")}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
