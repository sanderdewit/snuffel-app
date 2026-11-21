// Settings: language, appearance, offline home area, beta features, privacy and about.
// The language is one row that opens a searchable list (src/app/language.tsx).
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { LANGUAGES, phoneLanguage, useI18n } from "../i18n";
import { useBeta } from "../lib/beta";
import { CONFIG } from "../lib/config";
import { ToggleRow } from "../ui/Toggle";
import { SentReports } from "../ui/Rating";
import { kvGetJson } from "../lib/db";
import { currentPosition, LocationDeniedError } from "../lib/geo";
import { pinHomeArea } from "../lib/places";
import { Icon, Symbol, type IconName } from "../ui/Icon";
import { Input } from "../ui/Input";
import { useTheme, type AppearanceChoice } from "../ui/theme";

/** A card's title with its icon (a heading for screen readers). */
function Title({ icon, children }: { icon: ReactNode; children: string }) {
  const { S } = useTheme();
  return (
    <View style={[S.row, { gap: 10 }]} accessible accessibilityRole="header" accessibilityLabel={children}>
      {icon}
      <Text style={[S.h2, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

/** A link out of the app: a row of 44 px with the external-link icon. */
function OutLink({ label, url, quiet }: { label: string; url: string; quiet?: boolean }) {
  const { C, S } = useTheme();
  const color = quiet ? C.muted : C.link;
  return (
    <Pressable onPress={() => Linking.openURL(url).catch(() => undefined)} accessibilityRole="link"
      style={({ pressed }) => [S.row, { gap: 6, minHeight: 44 }, pressed && S.pressed]}>
      <Text style={[quiet ? S.muted : { color, fontWeight: "600" }, { flexShrink: 1 }]}>{label}</Text>
      <Icon name="external-link" size={quiet ? 14 : 16} color={color} />
    </Pressable>
  );
}

// Appearance: like the phone (light or dark, also when the phone switches at
// sunset), or always light or always dark. Kept on the phone.
function AppearanceCard() {
  const { t } = useI18n();
  const { C, S, appearance, setAppearance } = useTheme();
  const options: [AppearanceChoice, string, IconName][] = [
    [null, t("app_appearanceAuto"), "smartphone"], ["light", t("app_appearanceLight"), "sun"], ["dark", t("app_appearanceDark"), "moon"]
  ];
  return (
    <View style={[S.card, { gap: 10 }]}>
      <Title icon={<Icon name="moon" size={20} color={C.muted} />}>{t("app_appearance")}</Title>
      <View style={[S.row, { flexWrap: "wrap", gap: 6 }]} accessibilityRole="radiogroup" accessibilityLabel={t("app_appearance")}>
        {options.map(([value, label, icon]) => {
          const on = appearance === value;
          return (
            <Pressable key={value ?? "auto"} onPress={() => setAppearance(value)} accessibilityRole="radio" accessibilityState={{ checked: on }}
              style={({ pressed }) => [S.row, { gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: on ? C.brand : C.chip }, pressed && S.pressed]}>
              <Icon name={icon} size={16} color={on ? C.onBrand : C.text} />
              <Text style={{ color: on ? C.onBrand : C.text, fontWeight: on ? "700" : "400" }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Beta features: enter a code (checked by the server), then switch the AI voice
// conversation on or off. Leaving the beta forgets the code.
function BetaCard() {
  const { t } = useI18n();
  const { C, S } = useTheme();
  const beta = useBeta();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const join = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); setMsg(null);
    let r: Awaited<ReturnType<typeof beta.join>> = "failed";
    try { r = await beta.join(code); } catch { /* storing failed: shown as an error */ } finally { setBusy(false); }
    if (r === "ok") setCode("");
    else setMsg(t(r === "wrong" ? "app_betaWrong" : r === "rate_limited" ? "app_betaTooMany" : "app_errLoad"));
  };

  if (!beta.ready) return null;
  return (
    <View style={[S.card, { gap: 10 }]}>
      <Title icon={<Symbol name="flask-outline" size={20} color={C.muted} />}>{t("app_beta")}</Title>
      {!beta.joined ? (
        <>
          <Text style={S.body}>{t("app_betaText")}</Text>
          <View style={[S.row, { gap: 8 }]}>
            <Input style={[S.input, { flex: 1, minHeight: 44 }]} value={code} onChangeText={(v) => { setCode(v); setMsg(null); }}
              placeholder={t("app_betaCode")} autoCapitalize="characters" autoCorrect={false} autoComplete="off"
              maxLength={64} returnKeyType="done" onSubmitEditing={join} accessibilityLabel={t("app_betaCode")} />
            <Pressable style={({ pressed }) => [S.btn, (busy || !code.trim()) && { opacity: 0.5 }, pressed && S.pressed]} onPress={join}
              disabled={busy || !code.trim()} accessibilityRole="button" accessibilityState={{ disabled: busy || !code.trim(), busy }}>
              {busy ? <ActivityIndicator color={C.onBrand} /> : <Text style={S.btnText}>{t("app_betaJoin")}</Text>}
            </Pressable>
          </View>
          {!!msg && <Text style={[S.muted, { color: C.warn }]} accessibilityLiveRegion="polite">{msg}</Text>}
        </>
      ) : (
        <>
          <View style={[S.row, { gap: 8, alignItems: "flex-start" }]}>
            <Icon name="check-circle" size={18} color={C.ok} style={{ marginTop: 2 }} />
            <Text style={[S.body, { flex: 1, color: C.ok, fontWeight: "600" }]}>{t("app_betaJoined")}</Text>
          </View>
          <ToggleRow value={beta.voiceOn} onValueChange={(on) => { beta.setVoiceOn(on).catch(() => undefined); }}
            label={t("app_betaVoice")} detail={t("app_betaVoiceText")} bold
            icon={<Icon name="headphones" size={20} color={C.muted} style={{ alignSelf: "flex-start", marginTop: 1 }} />}
            style={{ alignItems: "flex-start" }} />
          <Pressable onPress={() => { beta.leave().catch(() => undefined); }} accessibilityRole="button"
            style={({ pressed }) => [{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }, pressed && S.pressed]}>
            <Text style={S.muted}>{t("app_betaLeave")}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function Settings() {
  const { t, tf, choice } = useI18n();
  const { C, S } = useTheme();
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

  // "Phone language (English)", or the chosen language's own name
  const nameOf = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;
  const language = choice ? nameOf(choice) : `${t("app_languageAuto")} (${nameOf(phoneLanguage())})`;

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Pressable onPress={() => router.push("/language")} accessibilityRole="button" accessibilityLabel={`${t("app_language")}: ${language}`}
        style={({ pressed }) => [S.card, S.row, { gap: 10, minHeight: 56 }, pressed && S.pressed]}>
        <Icon name="globe" size={20} color={C.muted} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={S.h2}>{t("app_language")}</Text>
          <Text style={S.muted}>{language}</Text>
        </View>
        <Icon name="chevron-right" size={20} color={C.muted} />
      </Pressable>

      <AppearanceCard />

      <View style={[S.card, { gap: 8 }]}>
        <Title icon={<Icon name="wifi-off" size={20} color={C.muted} />}>{t("app_offlineArea")}</Title>
        <Text style={S.body}>{t("app_offlineAreaText")}</Text>
        <Pressable style={({ pressed }) => [S.btn, S.row, { gap: 8 }, pressed && S.pressed]} onPress={setHomeHere} disabled={busy}
          accessibilityRole="button" accessibilityState={{ busy }}>
          {busy ? <ActivityIndicator color={C.onBrand} /> : <>
            <Icon name="home" size={18} color={C.onBrand} />
            <Text style={[S.btnText, { flexShrink: 1 }]}>{t("app_setHomeHere")}</Text>
          </>}
        </Pressable>
        {!!msg && <Text style={S.muted} accessibilityLiveRegion="polite">{msg}</Text>}
        {!msg && home && (
          <View style={[S.row, { gap: 6 }]}>
            <Icon name="check" size={14} color={C.muted} />
            <Text style={S.muted}>{new Date(home.at).toLocaleDateString()}</Text>
          </View>
        )}
      </View>

      <BetaCard />

      <View style={[S.card, { gap: 6 }]}>
        <Title icon={<Icon name="lock" size={20} color={C.muted} />}>{t("app_privacy")}</Title>
        <Text style={S.body}>{t("app_privacyText")}</Text>
        <Text style={S.body}>{t("app_fbPrivacy")}</Text>
        <SentReports />
        <OutLink label={t("app_privacy")} url={CONFIG.privacy} />
      </View>

      <View style={[S.card, { gap: 6 }]}>
        <Title icon={<Symbol name="paw" size={20} color={C.link} />}>{t("app_about")}</Title>
        <Text style={S.body}>{t("app_aboutText")}</Text>
        <Text style={[S.body, { fontStyle: "italic" }]}>{t("app_aboutThanks")}</Text>
        <OutLink label={t("website")} url={CONFIG.website} />
        <OutLink label={t("footerProto")} url="https://www.openstreetmap.org/copyright" quiet />
        <Pressable onPress={() => router.push("/welcome")} accessibilityRole="button"
          style={({ pressed }) => [S.row, { gap: 6, minHeight: 44 }, pressed && S.pressed]}>
          <Icon name="play-circle" size={16} color={C.link} />
          <Text style={{ color: C.link, fontWeight: "600", flexShrink: 1 }}>{t("app_ob_replay")}</Text>
        </Pressable>
        <Text style={S.muted}>{tf("app_version", { v: Constants.expoConfig?.version || "?" })}</Text>
      </View>
    </ScrollView>
  );
}
