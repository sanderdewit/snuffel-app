// Settings: language, offline home area, beta features, privacy and about.
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { LANGUAGES, useI18n } from "../i18n";
import { useBeta } from "../lib/beta";
import { CONFIG } from "../lib/config";
import { Toggle } from "../ui/Toggle";
import { kvGetJson } from "../lib/db";
import { currentPosition, LocationDeniedError } from "../lib/geo";
import { pinHomeArea } from "../lib/places";
import { C, S } from "../ui/theme";

// Beta features: enter a code (checked by the server), then switch the AI voice
// conversation on or off. Leaving the beta forgets the code.
function BetaCard() {
  const { t } = useI18n();
  const beta = useBeta();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const join = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); setMsg(null);
    const r = await beta.join(code);
    setBusy(false);
    if (r === "ok") setCode("");
    else setMsg(t(r === "wrong" ? "app_betaWrong" : r === "rate_limited" ? "app_betaTooMany" : "app_errLoad"));
  };

  if (!beta.ready) return null;
  return (
    <View style={[S.card, { gap: 10 }]}>
      <Text style={S.h2}>🧪 {t("app_beta")}</Text>
      {!beta.joined ? (
        <>
          <Text style={S.body}>{t("app_betaText")}</Text>
          <View style={[S.row, { gap: 8 }]}>
            <TextInput style={[S.input, { flex: 1 }]} value={code} onChangeText={(v) => { setCode(v); setMsg(null); }}
              placeholder={t("app_betaCode")} autoCapitalize="characters" autoCorrect={false} autoComplete="off"
              maxLength={64} returnKeyType="done" onSubmitEditing={join} accessibilityLabel={t("app_betaCode")} />
            <Pressable style={[S.btn, (busy || !code.trim()) && { opacity: 0.5 }]} onPress={join} disabled={busy || !code.trim()} accessibilityRole="button">
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>{t("app_betaJoin")}</Text>}
            </Pressable>
          </View>
          {!!msg && <Text style={[S.muted, { color: C.warn }]}>{msg}</Text>}
        </>
      ) : (
        <>
          <Text style={[S.body, { color: C.ok, fontWeight: "600" }]}>✓ {t("app_betaJoined")}</Text>
          <View style={[S.row, { gap: 12 }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[S.body, { fontWeight: "700" }]}>🎧 {t("app_betaVoice")}</Text>
              <Text style={S.muted}>{t("app_betaVoiceText")}</Text>
            </View>
            <Toggle value={beta.voiceOn} label={t("app_betaVoice")} onValueChange={(on) => { beta.setVoiceOn(on).catch(() => undefined); }} />
          </View>
          <Pressable onPress={() => { beta.leave().catch(() => undefined); }} hitSlop={8} accessibilityRole="button">
            <Text style={S.muted}>{t("app_betaLeave")}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function Settings() {
  const { t, tf, choice, setLanguage } = useI18n();
  const [home, setHome] = useState<{ at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { kvGetJson<{ at: number }>("home").then(setHome).catch(() => undefined); }, []);

  const setHomeHere = async () => {
    setBusy(true); setMsg(null);
    try {
      const pos = await currentPosition();
      const n = await pinHomeArea(pos.lat, pos.lon);
      setMsg(tf("app_homeSet", { n }));
      setHome({ at: Date.now() });
    } catch (e) {
      setMsg(e instanceof LocationDeniedError ? t("app_locationNeeded") : t("app_errLoad"));
    } finally { setBusy(false); }
  };

  const option = (code: string | null, label: string) => (
    <Pressable key={code ?? "auto"} onPress={() => setLanguage(code)}
      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: choice === code ? C.brand : C.chip }}>
      <Text style={{ color: choice === code ? "#fff" : C.text }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={[S.card, { gap: 10 }]}>
        <Text style={S.h2}>🌍 {t("app_language")}</Text>
        <View style={[S.row, { flexWrap: "wrap", gap: 6 }]}>
          {option(null, t("app_languageAuto"))}
          {LANGUAGES.map((l) => option(l.code, l.name))}
        </View>
      </View>

      <View style={[S.card, { gap: 8 }]}>
        <Text style={S.h2}>📶 {t("app_offlineArea")}</Text>
        <Text style={S.body}>{t("app_offlineAreaText")}</Text>
        <Pressable style={S.btn} onPress={setHomeHere} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>🏠 {t("app_setHomeHere")}</Text>}
        </Pressable>
        {!!msg && <Text style={S.muted}>{msg}</Text>}
        {!msg && home && <Text style={S.muted}>✓ {new Date(home.at).toLocaleDateString()}</Text>}
      </View>

      <BetaCard />

      <View style={[S.card, { gap: 6 }]}>
        <Text style={S.h2}>🔒 {t("app_privacy")}</Text>
        <Text style={S.body}>{t("app_privacyText")}</Text>
        <Pressable onPress={() => Linking.openURL(CONFIG.privacy)}><Text style={{ color: C.brandDark, fontWeight: "600" }}>{t("app_privacy")} ↗</Text></Pressable>
      </View>

      <View style={[S.card, { gap: 6 }]}>
        <Text style={S.h2}>🐾 {t("app_about")}</Text>
        <Text style={S.body}>{t("app_aboutText")}</Text>
        <Text style={[S.body, { fontStyle: "italic" }]}>{t("app_aboutThanks")}</Text>
        <Pressable onPress={() => Linking.openURL(CONFIG.website)}><Text style={{ color: C.brandDark, fontWeight: "600" }}>{t("website")} ↗</Text></Pressable>
        <Pressable onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}><Text style={S.muted}>{t("footerProto")} ↗</Text></Pressable>
        <Pressable onPress={() => router.push("/welcome")} accessibilityRole="button"><Text style={{ color: C.brandDark, fontWeight: "600" }}>🐾 {t("app_ob_replay")}</Text></Pressable>
        <Text style={S.muted}>{tf("app_version", { v: Constants.expoConfig?.version || "?" })}</Text>
      </View>
    </ScrollView>
  );
}
