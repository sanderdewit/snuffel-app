// AI voice conversation (beta): a live spoken conversation about the chosen
// dog. Starts when the screen opens, ends with "Hang up", after the time limit,
// or when the screen closes. The transcript is shown, not stored.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useI18n } from "../i18n";
import { useBeta } from "../lib/beta";
import { getDog, type Dog } from "../lib/dogs";
import { startVoice, type VoiceCall, type VoiceEnd, type VoiceLine, type VoiceState } from "../lib/realtime";
import { C, S } from "../ui/theme";

const END_TEXT: Record<VoiceEnd, string> = {
  done: "app_voiceAiEnded", time: "app_voiceAiTime", beta: "app_betaRevoked", rate_limited: "app_voiceAiLimit",
  unavailable: "aiReply", mic: "app_voiceDenied", failed: "aiError"
};

export default function Voice() {
  const { t, lang } = useI18n();
  const beta = useBeta();
  const { dog: dogParam } = useLocalSearchParams<{ dog?: string }>();
  const [state, setState] = useState<VoiceState>("connecting");
  const [lines, setLines] = useState<VoiceLine[]>([]);
  const [ended, setEnded] = useState<VoiceEnd | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const call = useRef<VoiceCall | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    let gone = false;
    (async () => {
      const dog: Dog | null = dogParam ? await getDog(Number(dogParam)).catch(() => null) : null;
      if (gone) return;
      call.current = await startVoice(lang, { emergency: t("emergencyBtn"), lost: t("lostTitle") }, dog, {
        onState: (s) => { if (!gone) setState(s); },
        onLines: (l) => { if (!gone) setLines(l); },
        onEnd: (reason) => {
          if (reason === "beta") beta.leave().catch(() => undefined);   // code taken out of the beta
          if (!gone) setEnded(reason);
        }
      });
      if (gone) call.current?.hangUp();
      else if (call.current) setLeft(call.current.maxSeconds);
    })();
    return () => { gone = true; call.current?.hangUp(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Time left, shown in the last two minutes.
  useEffect(() => {
    if (left == null || ended) return;
    const tick = setInterval(() => setLeft((s) => (s == null ? s : Math.max(0, s - 1))), 1000);
    return () => clearInterval(tick);
  }, [left == null, ended]);

  const status = ended ? null
    : state === "connecting" ? t("app_voiceAiConnecting")
    : state === "speaking" ? t("app_voiceAiSpeaking")
    : state === "thinking" ? t("app_voiceAiThinking")
    : t("app_voiceAiListening");

  return (
    <View style={[S.screen, { padding: 16, gap: 12 }]}>
      <Stack.Screen options={{ title: t("app_betaVoice") }} />
      <View style={[S.card, { alignItems: "center", gap: 10, paddingVertical: 24 }]}>
        <Text style={{ fontSize: 56 }}>{ended ? "🐾" : state === "speaking" ? "🗣️" : "🎧"}</Text>
        {status && (
          <View style={[S.row, { gap: 8 }]}>
            {(state === "connecting" || state === "thinking") && <ActivityIndicator color={C.brand} />}
            <Text style={[S.h2, { textAlign: "center" }]} accessibilityLiveRegion="polite">{status}</Text>
          </View>
        )}
        {!ended && left != null && left <= 120 && (
          <Text style={[S.muted, { color: C.warn }]}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</Text>
        )}
        {ended && <Text style={[S.body, { textAlign: "center" }]}>{t(END_TEXT[ended])}</Text>}
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {lines.map((l, i) => (
          <View key={i} style={{ alignSelf: l.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%",
            backgroundColor: l.role === "user" ? C.brandDark : C.card, borderRadius: 14, padding: 10, borderWidth: l.role === "user" ? 0 : 1, borderColor: C.line }}>
            <Text style={[S.body, { color: l.role === "user" ? "#fff" : C.text }]}>{l.text}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={S.muted}>🤖 {t("app_aiIsAI")} {t("app_voiceAiNote")}</Text>
      {ended ? (
        <Pressable style={S.btn} onPress={() => router.back()} accessibilityRole="button"><Text style={S.btnText}>{t("close")}</Text></Pressable>
      ) : (
        <Pressable style={[S.btn, { backgroundColor: C.danger }]} onPress={() => call.current?.hangUp()} accessibilityRole="button">
          <Text style={S.btnText}>{t("app_voiceAiHangUp")}</Text>
        </Pressable>
      )}
    </View>
  );
}
