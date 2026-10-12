// First-run walkthrough: welcome -> your area -> your dog -> your vet -> AI help -> done.
// Every step can be skipped; nothing is required to use the app. Permissions
// (location) are asked in context, on the step that needs them. Shown once
// (kv "onboarded"); Settings can replay it.
import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { useI18n } from "../i18n";
import { kvSet } from "../lib/db";
import { saveDog, validDate } from "../lib/dogs";
import { currentPosition, geocode, LocationDeniedError } from "../lib/geo";
import { pinHomeArea, search, type Place } from "../lib/places";
import { setMyVet } from "../lib/saved";
import { ChainBadge, displayName } from "../ui/PlaceCard";
import { C, S } from "../ui/theme";
import icon from "../../assets/icon.png";

const STEPS = 6;   // welcome, area, dog, vet, AI help, done

export default function Welcome() {
  const { t, tf, lang } = useI18n();
  // ?step=n opens a later step (screenshot runs; tools/screenshots.sh)
  const { step: startAt } = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState(() => Math.min(Math.max(Number(startAt) || 0, 0), STEPS - 1));

  // area
  const [spot, setSpot] = useState<{ lat: number; lon: number; gps: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [areaBusy, setAreaBusy] = useState(false);
  const [areaMsg, setAreaMsg] = useState<string | null>(null);

  // dog
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birth, setBirth] = useState("");
  const [weight, setWeight] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [dogMsg, setDogMsg] = useState<string | null>(null);
  // The dog being edited: going back to this step updates it instead of adding a copy.
  const [dogId, setDogId] = useState<number | null>(null);
  const [added, setAdded] = useState<string[]>([]);   // names of dogs saved before "add another"

  // vet
  const [vets, setVets] = useState<Place[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const done = async () => {
    await kvSet("onboarded", "1");
    if (router.canGoBack()) router.back(); else router.replace("/");
    // Searched by GPS: open Find around the phone right away.
    if (spot?.gps) setTimeout(() => router.navigate("/?near=1"), 300);
  };
  // AI help step: an example question opens AI help with it filled in (not sent),
  // for the dog just added.
  const tryQuestion = async (q: string) => {
    await kvSet("onboarded", "1");
    if (router.canGoBack()) router.back();
    setTimeout(() => router.navigate({ pathname: "/ask", params: { q, ...(dogId != null ? { dog: String(dogId) } : {}) } }), 300);
  };
  // A puppy (under a year) gets the house-training example.
  const puppy = !!birth && validDate(birth) && Date.now() - new Date(birth).getTime() < 365 * 864e5;
  const examples = (puppy ? ["app_aiStarter4", "app_aiStarter1", "app_aiStarter3"] : ["app_aiStarter1", "app_aiStarter2", "app_aiStarter3"]).map((k) => t(k));

  const useArea = async (lat: number, lon: number, gps: boolean) => {
    const n = await pinHomeArea(lat, lon);
    setSpot({ lat, lon, gps });
    setAreaMsg(tf("app_ob_areaDone", { n }));
    setVets(null);
  };
  const areaByGps = async () => {
    setAreaBusy(true); setAreaMsg(null);
    try { const pos = await currentPosition(); await useArea(pos.lat, pos.lon, true); }
    catch (e) { setAreaMsg(e instanceof LocationDeniedError ? t("app_locationNeeded") : t("app_errLoad")); }
    finally { setAreaBusy(false); }
  };
  const areaByText = async () => {
    if (!query.trim()) return;
    setAreaBusy(true); setAreaMsg(null);
    try {
      const hit = await geocode(query.trim(), lang);
      if (!hit) setAreaMsg(t("noResults")); else await useArea(hit.lat, hit.lon, false);
    } catch { setAreaMsg(t("app_errLoad")); }
    finally { setAreaBusy(false); }
  };

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (r.canceled || !r.assets[0]) return;
    const dest = new File(Paths.document, `dog-${Date.now()}.jpg`);
    await new File(r.assets[0].uri).copy(dest);
    setPhoto(dest.uri);
  };
  // Saves the form; false when there is nothing (valid) to save.
  const persistDog = async (): Promise<boolean> => {
    if (!name.trim()) return false;
    if (birth && !validDate(birth)) { setDogMsg(t("app_invalidDate")); return false; }
    setDogMsg(null);
    const kg = weight ? Number(weight.replace(",", ".")) : null;
    setDogId(await saveDog({ id: dogId ?? undefined, name: name.trim(), breed: breed.trim() || null, birth: birth || null,
      weight: kg != null && kg > 0 && kg < 150 ? kg : null, sex: null, neutered: null, photo }));
    return true;
  };
  const saveDogStep = async () => {
    if (name.trim() && !(await persistDog())) return;   // invalid date: stay
    next();
  };
  // More than one dog: save this one and start an empty form for the next.
  const addAnother = async () => {
    if (!(await persistDog())) return;
    setAdded((a) => [...a, name.trim()]);
    setDogId(null); setName(""); setBreed(""); setBirth(""); setWeight(""); setPhoto(null);
  };

  const loadVets = async (s: { lat: number; lon: number }) => {
    try {
      const all = (await search(s.lat, s.lon, 10000)).filter((p) => p.cat === "vet" || p.cat === "hospital");
      // independents first, then distance
      all.sort((a, b) => (a.chain ? 1 : 0) - (b.chain ? 1 : 0) || a.dist - b.dist);
      setVets(all.slice(0, 8));
    } catch { setVets([]); }
  };
  const chooseVet = async (p: Place) => { await setMyVet(p, true); setChosen(p.id); };

  const next = () => {
    const n = step + 1;
    if (n === 3 && spot && !vets) loadVets(spot);
    setStep(n);
  };

  const footer = (primary: { label: string; onPress: () => void; busy?: boolean }, secondary?: { label: string; onPress: () => void }) => (
    <View style={{ gap: 8, paddingTop: 8 }}>
      <Pressable style={S.btn} onPress={primary.onPress} disabled={primary.busy} accessibilityRole="button">
        {primary.busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>{primary.label}</Text>}
      </Pressable>
      {secondary && (
        <Pressable style={[S.btnGhost, { backgroundColor: "transparent" }]} onPress={secondary.onPress} accessibilityRole="button">
          <Text style={[S.btnGhostText, { color: C.muted }]}>{secondary.label}</Text>
        </Pressable>
      )}
    </View>
  );

  const header = (title: string, text: string) => (
    <View style={{ gap: 8 }}>
      <Text style={S.muted}>{tf("app_ob_step", { n: step, total: STEPS - 2 })}</Text>
      <Text style={[S.h1, { fontSize: 26 }]}>{title}</Text>
      <Text style={S.body}>{text}</Text>
    </View>
  );

  let body: React.ReactNode, foot: React.ReactNode;
  if (step === 0) {
    body = (
      <View style={{ gap: 18, alignItems: "center", paddingTop: 24 }}>
        <Image source={icon} style={{ width: 120, height: 120, borderRadius: 28 }} accessibilityIgnoresInvertColors />
        <Text style={[S.h1, { fontSize: 28, textAlign: "center" }]}>{t("app_ob_welcomeTitle")}</Text>
        <Text style={[S.body, { textAlign: "center" }]}>{t("app_ob_welcomeText")}</Text>
        <View style={{ gap: 12, alignSelf: "stretch", marginTop: 8 }}>
          {[["🩺", "app_ob_f1"], ["🚨", "app_ob_f2"], ["💬", "app_ob_f3"], ["📁", "app_ob_f4"]].map(([e, k]) => (
            <View key={k} style={[S.row, { gap: 12, alignItems: "flex-start" }]}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
              <Text style={[S.body, { flex: 1 }]}>{t(k)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
    foot = footer({ label: t("app_ob_start"), onPress: next }, { label: t("app_ob_skip"), onPress: done });
  } else if (step === 1) {
    body = (
      <View style={{ gap: 14 }}>
        {header(t("app_ob_areaTitle"), t("app_ob_areaText"))}
        <Pressable style={S.btn} onPress={areaByGps} disabled={areaBusy} accessibilityRole="button">
          <Text style={S.btnText}>📍 {t("useLocation")}</Text>
        </Pressable>
        <Text style={S.muted}>{t("app_ob_postcode")}</Text>
        <View style={[S.row, { gap: 8 }]}>
          <TextInput style={[S.input, { flex: 1 }]} value={query} onChangeText={setQuery} placeholder={t("searchPlaceholder")}
            returnKeyType="search" onSubmitEditing={areaByText} autoCorrect={false} />
          <Pressable style={S.btnGhost} onPress={areaByText} disabled={areaBusy} accessibilityRole="button"><Text style={S.btnGhostText}>OK</Text></Pressable>
        </View>
        {areaBusy && <ActivityIndicator color={C.brand} />}
        {!!areaMsg && <Text style={[S.body, { color: spot ? C.ok : C.danger }]}>{spot ? "✓ " : ""}{areaMsg}</Text>}
      </View>
    );
    foot = footer({ label: t("app_ob_next"), onPress: next }, spot ? undefined : { label: t("app_ob_later"), onPress: next });
  } else if (step === 2) {
    body = (
      <View style={{ gap: 12 }}>
        {header(t("app_ob_dogTitle"), t("app_ob_dogText"))}
        <Pressable onPress={pickPhoto} style={{ alignSelf: "center", alignItems: "center", gap: 6 }} accessibilityRole="button">
          {photo
            ? <Image source={{ uri: photo }} style={{ width: 96, height: 96, borderRadius: 48 }} />
            : <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.chip, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 42 }}>🐶</Text></View>}
          <Text style={{ color: C.brandDark, fontWeight: "600" }}>{t("app_choosePhoto")}</Text>
        </Pressable>
        <Text style={S.muted}>{t("app_dogName")}</Text>
        <TextInput style={S.input} value={name} onChangeText={setName} maxLength={40} />
        <Text style={S.muted}>{t("app_breed")}</Text>
        <TextInput style={S.input} value={breed} onChangeText={setBreed} maxLength={40} />
        <View style={[S.row, { gap: 8 }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={S.muted}>{t("app_birthDate")}</Text>
            <TextInput style={S.input} value={birth} onChangeText={setBirth} placeholder="2021-04-30" keyboardType="numbers-and-punctuation" maxLength={10} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={S.muted}>{t("app_weight")}</Text>
            <TextInput style={S.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} />
          </View>
        </View>
        {!!dogMsg && <Text style={[S.body, { color: C.danger }]}>{dogMsg}</Text>}
        {!!name.trim() && (
          <Pressable style={[S.btnGhost, { alignSelf: "flex-start" }]} onPress={addAnother} accessibilityRole="button">
            <Text style={S.btnGhostText}>{t("app_ob_addAnother")}</Text>
          </Pressable>
        )}
        {added.length > 0 && <Text style={[S.body, { color: C.ok }]}>✓ {tf("app_ob_dogsAdded", { names: added.join(", ") })}</Text>}
      </View>
    );
    foot = footer({ label: t("app_ob_next"), onPress: saveDogStep }, name.trim() || added.length ? undefined : { label: t("app_ob_later"), onPress: next });
  } else if (step === 3) {
    body = (
      <View style={{ gap: 12 }}>
        {header(t("app_ob_vetTitle"), t("app_ob_vetText"))}
        {!spot ? <Text style={S.muted}>{t("app_ob_vetNeedsArea")}</Text>
          : vets == null ? <ActivityIndicator color={C.brand} />
          : !vets.length ? <Text style={S.muted}>{t("app_ob_vetNone")}</Text>
          : vets.map((p) => (
            <Pressable key={p.id} onPress={() => chooseVet(p)} accessibilityRole="radio" accessibilityState={{ checked: chosen === p.id }}
              style={[S.card, { gap: 2, borderColor: chosen === p.id ? C.brand : C.line, borderWidth: chosen === p.id ? 2 : 1 }]}>
              <Text style={S.h2}>{chosen === p.id ? "⭐ " : ""}{displayName(p, t)}</Text>
              <Text style={S.muted} numberOfLines={1}>{tf("distanceAway", { km: p.dist.toFixed(1) })}{p.address ? " · " + p.address : ""}</Text>
              <ChainBadge p={p} />
            </Pressable>
          ))}
      </View>
    );
    foot = footer({ label: t("app_ob_next"), onPress: next }, chosen ? undefined : { label: t("app_ob_later"), onPress: next });
  } else if (step === 4) {
    body = (
      <View style={{ gap: 12 }}>
        {header(t("app_ob_aiTitle"), t("app_ob_aiText"))}
        <Text style={[S.muted, { marginTop: 4 }]}>{t("app_ob_aiTry")}</Text>
        {examples.map((q) => (
          <Pressable key={q} onPress={() => tryQuestion(q)} accessibilityRole="button"
            style={[S.card, S.row, { gap: 10 }]}>
            <Text style={{ fontSize: 20 }}>💬</Text>
            <Text style={[S.body, { flex: 1 }]}>{q}</Text>
            <Text style={{ color: C.muted, fontSize: 20 }}>›</Text>
          </Pressable>
        ))}
      </View>
    );
    foot = footer({ label: t("app_ob_next"), onPress: next });
  } else {
    body = (
      <View style={{ gap: 16, alignItems: "center", paddingTop: 40 }}>
        <Text style={{ fontSize: 64 }}>🐾</Text>
        <Text style={[S.h1, { fontSize: 28 }]}>{t("app_ob_doneTitle")}</Text>
        <Text style={[S.body, { textAlign: "center" }]}>{t("app_ob_doneText")}</Text>
      </View>
    );
    foot = footer({ label: t("app_ob_finish"), onPress: done });
  }

  return (
    <SafeAreaView style={S.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[S.row, { justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, minHeight: 36 }]}>
          {step > 0 && step < STEPS - 1
            ? <Pressable onPress={() => setStep(step - 1)} hitSlop={12} accessibilityRole="button" accessibilityLabel="←"><Text style={{ fontSize: 22, color: C.muted }}>←</Text></Pressable>
            : <View />}
          {step > 0 && step < STEPS - 1 && (
            <Pressable onPress={done} hitSlop={12} accessibilityRole="button"><Text style={{ color: C.muted, fontWeight: "600" }}>{t("app_ob_skip")}</Text></Pressable>
          )}
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>{foot}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
