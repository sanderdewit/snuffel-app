// AI voice conversation (beta): a live spoken conversation about the chosen
// dog. Starts when the screen opens, ends with "Hang up", after the time limit,
// or when the screen closes. The transcript is shown, not stored. With a dog
// chosen, hanging up (or the time limit) brings a note for its file of the signs
// the owner mentioned: added only when the owner taps it, as in the chat (undo).
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, type ScrollViewInstance, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useI18n } from "../i18n";
import { useBeta } from "../lib/beta";
import { formatDate } from "../lib/dates";
import { deleteRecordById, fileObservation } from "../lib/dogfile";
import { getDog, type Dog } from "../lib/dogs";
import { startVoice, type VoiceCall, type VoiceEnd, type VoiceLine, type VoiceState } from "../lib/realtime";
import type { VoiceNote } from "../lib/voicenote";
import { C, S } from "../ui/theme";

const END_TEXT: Record<VoiceEnd, string> = {
  done: "app_voiceAiEnded", time: "app_voiceAiTime", beta: "app_betaRevoked", rate_limited: "app_voiceAiLimit",
  unavailable: "aiReply", mic: "app_voiceDenied", failed: "aiError"
};
// The chat's urgency colours (ask.tsx): "keep an eye on it" is not green, "today" between amber and red.
const URGENCY_COLOR: Record<VoiceNote["urgency"], string> = { emergency: C.danger, vet_today: "#c2410c", vet_soon: C.warn, monitor: "#1d4ed8", unclear: C.muted };

export default function Voice() {
  const { t, tf, lang } = useI18n();
  const beta = useBeta();
  const { dog: dogParam } = useLocalSearchParams<{ dog?: string }>();
  const [state, setState] = useState<VoiceState>("connecting");
  const [lines, setLines] = useState<VoiceLine[]>([]);
  const [ended, setEnded] = useState<VoiceEnd | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [dog, setDog] = useState<Dog | null>(null);
  const [noting, setNoting] = useState(false);                  // the note for the dog's file is on its way
  const [note, setNote] = useState<VoiceNote | null>(null);
  const [filed, setFiled] = useState<number | null>(null);      // the file entry, once added
  const call = useRef<Pick<VoiceCall, "hangUp"> | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    // Everything for this run stays local, so a second run can never lose a handle.
    let gone = false, stopped = false;
    let handle: VoiceCall | null = null;
    // "Hang up" works from the first moment, also while the dog is still loading.
    call.current = { hangUp: () => { stopped = true; if (handle) handle.hangUp(); else if (!gone) setEnded("done"); } };
    (async () => {
      const d: Dog | null = dogParam ? await getDog(Number(dogParam)).catch(() => null) : null;
      if (gone || stopped) return;
      setDog(d);
      handle = startVoice(lang, { emergency: t("emergencyBtn"), lost: t("lostTitle") }, d, {
        onState: (s) => { if (!gone) setState(s); },
        onLines: (l) => { if (!gone) setLines(l); },
        onConnected: (maxSeconds) => { if (!gone) setLeft(maxSeconds); },
        onEnd: (reason, notePending) => {
          if (reason === "beta") beta.leave().catch(() => undefined);   // code taken out of the beta
          if (!gone) { setEnded(reason); setNoting(notePending); }
        },
        onNote: (n) => { if (!gone) { setNoting(false); setNote(n); } }
      });
    })();
    // Closing the screen ends the call at once, without waiting for a note.
    return () => { gone = true; stopped = true; handle?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Time left, shown in the last two minutes.
  useEffect(() => {
    if (left == null || ended) return;
    const tick = setInterval(() => setLeft((s) => (s == null ? s : Math.max(0, s - 1))), 1000);
    return () => clearInterval(tick);
  }, [left == null, ended]);

  // The note goes into the file only when tapped (as "Add" in the chat); undo takes it out again.
  const addNote = async () => {
    if (!dog || !note || filed != null) return;
    setFiled(await fileObservation(dog.id, note.observation).catch(() => null));
  };
  const undoNote = async () => {
    if (filed == null) return;
    await deleteRecordById(filed).catch(() => undefined);
    setFiled(null);
  };

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

      {/* The note for the dog's file: on its way, then ready to add (or added: undo) */}
      {ended && dog && noting && (
        <View style={[S.row, { gap: 8, justifyContent: "center" }]}>
          <ActivityIndicator color={C.brand} />
          <Text style={S.muted} accessibilityLiveRegion="polite">{tf("app_voiceNoteWait", { name: dog.name })}</Text>
        </View>
      )}
      {ended && dog && note && (
        <View style={[S.card, { gap: 6, backgroundColor: C.chip }]} accessibilityLiveRegion="polite">
          {note.urgency !== "unclear" && (
            <Text style={{ fontWeight: "700", color: URGENCY_COLOR[note.urgency] }}>
              {t(note.urgency === "vet_today" ? "app_urgency_vet_today" : "urgency_" + note.urgency)}
            </Text>
          )}
          <Text style={[S.body, { fontWeight: "700" }]}>
            {filed != null ? "✓ " + tf("app_obsFiled", { name: dog.name }) : "📝 " + tf("app_voiceNoteAsk", { name: dog.name })}
          </Text>
          <Text style={S.body}><Text style={{ fontWeight: "700" }}>{note.observation.title}</Text> · {formatDate(note.observation.date, lang)}</Text>
          {!!note.observation.details && <Text style={S.muted}>{note.observation.details}</Text>}
          <Pressable onPress={filed != null ? undoNote : addNote} hitSlop={8} accessibilityRole="button" style={{ alignSelf: "flex-start", paddingVertical: 4 }}>
            <Text style={{ color: C.brandDark, fontWeight: "600" }}>{t(filed != null ? "app_undo" : "app_add")}</Text>
          </Pressable>
        </View>
      )}

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
