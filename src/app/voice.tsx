// AI voice conversation (beta): a live spoken conversation about the chosen
// dog. Starts when the screen opens, ends with "Hang up", after the time limit,
// or when the screen closes. The transcript is shown, not stored. With a dog
// chosen, hanging up (or the time limit) brings a note for its file of the signs
// the owner mentioned: added only when the owner taps it, as in the chat (undo).
// The bars under the status show the microphone's level (lit in the link colour
// while the AI hears speech), so a silent microphone is visible; when the phone
// sends no sound at all the call ends with a message (realtime.ts) and can be
// started again here. "Emergency", under Hang up, is always at hand: it ends the
// call at once and opens the Emergency tab.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, type ScrollViewInstance, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useI18n } from "../i18n";
import { useBeta } from "../lib/beta";
import { formatDate } from "../lib/dates";
import { deleteRecordById, fileObservation } from "../lib/dogfile";
import { getDog, type Dog } from "../lib/dogs";
import { levelBars } from "../lib/micwatch";
import { startVoice, type VoiceCall, type VoiceEnd, type VoiceLine, type VoiceState } from "../lib/realtime";
import type { VoiceNote } from "../lib/voicenote";
import { Icon, Symbol } from "../ui/Icon";
import { UrgencyLabel } from "../ui/Urgency";
import { useTheme } from "../ui/theme";

const END_TEXT: Record<VoiceEnd, string> = {
  done: "app_voiceAiEnded", time: "app_voiceAiTime", beta: "app_betaRevoked", rate_limited: "app_voiceAiLimit",
  unavailable: "aiReply", mic: "app_voiceDenied", nomic: "app_voiceNoMic", failed: "aiError"
};
const AGAIN: VoiceEnd[] = ["nomic", "failed"];   // ends worth a "Try again" here
const BARS = 5;

export default function Voice() {
  const { t, tf, lang } = useI18n();
  const { C, S } = useTheme();
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
  const [level, setLevel] = useState<number | undefined>(undefined);
  const [detail, setDetail] = useState<string | null>(null);    // the audio state after "nomic"
  const [run, setRun] = useState(0);                            // "Try again" starts a new call
  const call = useRef<Pick<VoiceCall, "hangUp" | "close"> | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    // Everything for this run stays local, so a second run can never lose a handle.
    let gone = false, stopped = false;
    let handle: VoiceCall | null = null;
    // "Hang up" works from the first moment, also while the dog is still loading;
    // close (Emergency) ends the call at once, without waiting for a note.
    call.current = {
      hangUp: () => { stopped = true; if (handle) handle.hangUp(); else if (!gone) setEnded("done"); },
      close: () => { stopped = true; handle?.close(); }
    };
    (async () => {
      const d: Dog | null = dogParam ? await getDog(Number(dogParam)).catch(() => null) : null;
      if (gone || stopped) return;
      setDog(d);
      handle = startVoice(lang, { emergency: t("emergencyBtn"), lost: t("lostTitle") }, d, {
        onState: (s) => { if (!gone) setState(s); },
        onLines: (l) => { if (!gone) setLines(l); },
        onConnected: (maxSeconds) => { if (!gone) setLeft(maxSeconds); },
        onEnd: (reason, notePending, info) => {
          if (reason === "beta") beta.leave().catch(() => undefined);   // code taken out of the beta
          if (!gone) { setEnded(reason); setNoting(notePending); setDetail(info || null); }
        },
        onNote: (n) => { if (!gone) { setNoting(false); setNote(n); } },
        onLevel: (l) => { if (!gone) setLevel(l); }
      });
    })();
    // Closing the screen ends the call at once, without waiting for a note.
    return () => { gone = true; stopped = true; handle?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const again = () => {
    setState("connecting"); setLines([]); setEnded(null); setLeft(null); setNoting(false);
    setNote(null); setFiled(null); setLevel(undefined); setDetail(null);
    setRun((r) => r + 1);
  };

  // Emergency: the call ends (no note: no time for it now) and the Emergency tab opens.
  const emergency = () => {
    call.current?.close();
    router.dismissTo("/(tabs)/emergency");   // back to the tabs, not a second set of them
  };

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
    : t("app_voiceAiListening");                                  // listening, hearing
  const lit = levelBars(level, BARS);
  const tryAgain = !!ended && AGAIN.includes(ended) && !noting;

  return (
    <View style={[S.screen, { padding: 16, gap: 12 }]}>
      <Stack.Screen options={{ title: t("app_betaVoice") }} />
      <View style={[S.card, { alignItems: "center", gap: 10, paddingVertical: 24 }]}>
        {/* The state as a line icon on the chip disc (the status text below says it in words):
            headphones while listening or thinking, a speaking head while the AI talks, a paw at the end */}
        <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", backgroundColor: C.chip }}>
          {ended ? <Symbol name="paw" size={46} color={C.link} />
            : state === "speaking" ? <Symbol name="account-voice" size={48} color={C.link} />
            : <Icon name="headphones" size={44} color={C.link} />}
        </View>
        {status && (
          <View style={[S.row, { gap: 8 }]}>
            {(state === "connecting" || state === "thinking") && <ActivityIndicator color={C.brand} />}
            <Text style={[S.h2, { textAlign: "center" }]} accessibilityLiveRegion="polite">{status}</Text>
          </View>
        )}
        {/* The microphone's level: is the phone hearing anything? */}
        {!ended && left != null && level !== undefined && (
          <View style={[S.row, { gap: 4, height: 20, alignItems: "flex-end" }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: BARS }, (_, i) => (
              <View key={i} style={{ width: 6, height: 6 + i * 3.5, borderRadius: 3,
                backgroundColor: i < lit ? (state === "hearing" ? C.link : C.muted) : C.line }} />
            ))}
          </View>
        )}
        {!ended && left != null && left <= 120 && (
          <Text style={[S.muted, { color: C.warn }]}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</Text>
        )}
        {ended && <Text style={[S.body, { textAlign: "center" }]}>{t(END_TEXT[ended])}</Text>}
        {ended && !!detail && (
          <View style={[S.row, { gap: 4, justifyContent: "center" }]}>
            <Icon name="tool" size={11} color={C.muted} />
            <Text style={[S.muted, { flexShrink: 1, fontSize: 11, textAlign: "center" }]} selectable>{detail}</Text>
          </View>
        )}
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
          {/* The level with its own icon, not colour alone */}
          {note.urgency !== "unclear" && <UrgencyLabel level={note.urgency} />}
          <View style={[S.row, { gap: 6 }]}>
            <Icon name={filed != null ? "check" : "file-plus"} size={16} color={filed != null ? C.ok : C.text} />
            <Text style={[S.body, { flex: 1, fontWeight: "700" }]}>
              {tf(filed != null ? "app_obsFiled" : "app_voiceNoteAsk", { name: dog.name })}
            </Text>
          </View>
          <Text style={S.body}><Text style={{ fontWeight: "700" }}>{note.observation.title}</Text> · {formatDate(note.observation.date, lang)}</Text>
          {!!note.observation.details && <Text style={S.muted}>{note.observation.details}</Text>}
          <Pressable onPress={filed != null ? undoNote : addNote} accessibilityRole="button"
            style={({ pressed }) => [{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingRight: 12 }, pressed && S.pressed]}>
            <Text style={{ color: C.link, fontWeight: "600" }}>{t(filed != null ? "app_undo" : "app_add")}</Text>
          </Pressable>
        </View>
      )}

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {lines.map((l, i) => (
          <View key={i} style={{ alignSelf: l.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%",
            backgroundColor: l.role === "user" ? C.brandDark : C.card, borderRadius: 14, padding: 10, borderWidth: l.role === "user" ? 0 : 1, borderColor: C.line }}>
            <Text style={[S.body, { color: l.role === "user" ? C.onBrand : C.text }]}>{l.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[S.row, { gap: 6, alignItems: "flex-start" }]}>
        <Symbol name="robot-outline" size={16} color={C.muted} style={{ marginTop: 1 }} />
        <Text style={[S.muted, { flex: 1 }]}>{t("app_aiIsAI")} {t("app_voiceAiNote")}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {ended ? (
          <>
            {tryAgain && (
              <Pressable style={({ pressed }) => [S.btn, pressed && S.pressed]} onPress={again} accessibilityRole="button">
                <Text style={S.btnText}>{t("app_retry")}</Text>
              </Pressable>
            )}
            <Pressable style={({ pressed }) => [tryAgain ? S.btnGhost : S.btn, pressed && S.pressed]} onPress={() => router.back()} accessibilityRole="button">
              <Text style={tryAgain ? S.btnGhostText : S.btnText}>{t("close")}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={({ pressed }) => [S.btn, S.row, { gap: 8, backgroundColor: C.dangerFill }, pressed && S.pressed]}
            onPress={() => call.current?.hangUp()} accessibilityRole="button">
            <Icon name="phone-off" size={20} color={C.onBrand} />
            <Text style={S.btnText}>{t("app_voiceAiHangUp")}</Text>
          </Pressable>
        )}
        {/* Secondary, under Hang up (and Close): straight to the nearest open vet */}
        <Pressable onPress={emergency} accessibilityRole="button"
          style={({ pressed }) => [S.row, { gap: 8, minHeight: 48, justifyContent: "center", borderRadius: 12, borderWidth: 2,
            borderColor: C.danger, backgroundColor: C.card, paddingHorizontal: 12 }, pressed && S.pressed]}>
          <Icon name="alert-octagon" size={20} color={C.danger} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.danger }}>{t("emergencyBtn")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
