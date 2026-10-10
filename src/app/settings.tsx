// Settings: language, offline home area, privacy and about.
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import Constants from "expo-constants";
import { LANGUAGES, useI18n } from "../i18n";
import { CONFIG } from "../lib/config";
import { kvGetJson } from "../lib/db";
import { currentPosition, LocationDeniedError } from "../lib/geo";
import { pinHomeArea } from "../lib/places";
import { C, S } from "../ui/theme";

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

      <View style={[S.card, { gap: 6 }]}>
        <Text style={S.h2}>🔒 {t("app_privacy")}</Text>
        <Text style={S.body}>{t("app_privacyText")}</Text>
      </View>

      <View style={[S.card, { gap: 6 }]}>
        <Text style={S.h2}>🐾 {t("app_about")}</Text>
        <Text style={S.body}>{t("app_aboutText")}</Text>
        <Pressable onPress={() => Linking.openURL(CONFIG.website)}><Text style={{ color: C.brandDark, fontWeight: "600" }}>{t("website")} ↗</Text></Pressable>
        <Pressable onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}><Text style={S.muted}>{t("footerProto")} ↗</Text></Pressable>
        <Text style={S.muted}>{tf("app_version", { v: Constants.expoConfig?.version || "?" })}</Text>
      </View>
    </ScrollView>
  );
}
