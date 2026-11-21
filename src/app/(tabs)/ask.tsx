// AI help with health and behaviour. With a dog chosen, its profile (and, if
// the owner allows it, a summary of its file) goes along so the advice fits
// that dog. Each dog has its own conversation, kept on the phone.
//
// An answer is one card, in the order that matters when something is wrong: the
// urgency band (the level's colour and icon, "AI first assessment, not a
// diagnosis"), then what to do (call my vet, find an open vet now), then the
// advice, then Read aloud / Save to the file / thumbs. The header holds the voice
// options (one headset button: conversation mode, and the beta voice call) and
// New chat; under it one row with the dog and the health-file switch; at the
// bottom one composer row (the field with the mic inside, a round Send).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n";
import { addChat, ask, clearChat, loadChat, type AnswerParts, type ChatMessage } from "../../lib/ai";
import { useBeta } from "../../lib/beta";
import { kvGet, kvSet } from "../../lib/db";
import { ageMonths, listDogs, today, type Dog } from "../../lib/dogs";
import { addRecord, autoFile, deleteRecordById, fileObservation, setShareFileWithAi, shareFileWithAi, type Observation } from "../../lib/dogfile";
import { formatDate } from "../../lib/dates";
import { lastQuestion, openingDog, otherDogOptions, storedDog } from "../../lib/dogchoice";
import { myVet, type SavedPlace } from "../../lib/saved";
import { retryOnServer, speak, startListening, stopListening, stopSpeaking } from "../../lib/voice";
import { isStopPhrase } from "../../lib/talk";
import { takeQuestion } from "../../lib/handoff";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import { callUrl } from "../../ui/PlaceCard";
import { DogChips, DogSwitcher } from "../../ui/DogSwitcher";
import { Icon, Symbol, type IconName } from "../../ui/Icon";
import { Rating } from "../../ui/Rating";
import { Input } from "../../ui/Input";
import { Toggle } from "../../ui/Toggle";
import { AssessmentNote, UrgencyBand, isLevel, levelKey, withoutEmoji } from "../../ui/Urgency";
import { useTheme } from "../../ui/theme";

// Example questions for an empty conversation; a puppy gets house-training first.
function starters(dog: Dog | null): string[] {
  const months = dog ? ageMonths(dog.birth) : null;
  return months != null && months < 12
    ? ["app_aiStarter4", "app_aiStarter1", "app_aiStarter3", "app_aiStarter5"]
    : ["app_aiStarter1", "app_aiStarter3", "app_aiStarter2", "app_aiStarter5"];
}

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };

// A structured answer: the verdict first (readable in five seconds), then the
// steps, the signs to get help sooner, and the follow-up questions.
function Answer({ parts, onFull }: { parts: AnswerParts; onFull: () => void }) {
  const { t } = useI18n();
  const { C, S } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {!!parts.summary && <Text style={[S.body, { fontWeight: "700" }]}>{parts.summary}</Text>}
      {parts.steps.map((s, n) => (
        <View key={n} style={[S.row, { gap: 8, alignItems: "flex-start" }]}>
          <Text style={[S.body, { fontWeight: "700", color: C.link, minWidth: 16 }]}>{n + 1}.</Text>
          <Text style={[S.body, { flex: 1 }]}>{s}</Text>
        </View>
      ))}
      {parts.watch_for.length > 0 && (
        <View style={{ gap: 2, marginTop: 2 }}>
          <View style={[S.row, { gap: 6 }]}>
            <Icon name="alert-triangle" size={14} color={C.warn} />
            <Text style={[S.muted, { flex: 1, fontWeight: "700", color: C.warn }]}>{t("app_aiWatchFor")}</Text>
          </View>
          {parts.watch_for.map((w, n) => <Text key={n} style={S.body}>• {w}</Text>)}
        </View>
      )}
      {parts.questions.map((q, n) => <Text key={n} style={[S.body, { fontStyle: "italic" }]}>{q}</Text>)}
      <Pressable onPress={onFull} accessibilityRole="button"
        style={({ pressed }) => [{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }, pressed && S.pressed]}>
        <Text style={[S.muted, { fontSize: 14, textDecorationLine: "underline" }]}>{t("app_aiFullAnswer")}</Text>
      </Pressable>
    </View>
  );
}

// What to do next, at the top of the answer: the first filled, any further one outlined.
interface NextStep { label: string; icon: (color: string) => ReactNode; go: () => void; danger?: boolean }
function NextButton({ step, first }: { step: NextStep; first: boolean }) {
  const { C, S } = useTheme();
  const ink = first ? C.onBrand : step.danger ? C.danger : C.link;
  return (
    <Pressable onPress={step.go} accessibilityRole="button"
      style={({ pressed }) => [S.row, { minHeight: 48, gap: 8, justifyContent: "center", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
        first ? { backgroundColor: step.danger ? C.dangerFill : C.brand }
          : { backgroundColor: C.card, borderWidth: 2, borderColor: step.danger ? C.danger : C.link },
        pressed && S.pressed]}>
      {step.icon(ink)}
      <Text style={{ flexShrink: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: ink }}>{step.label}</Text>
    </Pressable>
  );
}

// A 44 px icon button in the navigation header.
function HeaderButton({ icon, label, onPress, on, expanded }: { icon: IconName; label: string; onPress: () => void; on?: boolean; expanded?: boolean }) {
  const { C, S } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={expanded == null ? undefined : { expanded }}
      style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, marginHorizontal: 6, alignItems: "center", justifyContent: "center" },
        on && { backgroundColor: C.brandDark }, pressed && S.pressed]}>
      <Icon name={icon} size={22} color={on ? C.onBrand : C.link} />
    </Pressable>
  );
}

// A row that is one switch for screen readers (label and state), drawn with the app's Toggle.
function SwitchRow({ label, value, onChange, children, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  const { S } = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} disabled={disabled} accessibilityRole="switch" accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={({ pressed }) => [S.row, { gap: 10, minHeight: 44 }, disabled && { opacity: 0.5 }, pressed && S.pressed]}>
      {children}
      <View pointerEvents="none" {...hidden}><Toggle value={value} onValueChange={() => undefined} /></View>
    </Pressable>
  );
}

// Behind the headset button: conversation mode for everyone, the live voice call for beta users.
function VoiceSheet({ visible, onClose, talk, canTalk, onTalk, beta, canCall, onCall }: {
  visible: boolean; onClose: () => void; talk: boolean; canTalk: boolean; onTalk: () => void; beta: boolean; canCall: boolean; onCall: () => void;
}) {
  const { t } = useI18n();
  const { C, S } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        {/* A veil in the screen's own colour, light or dark: the chat steps back */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("close")}>
          <View style={{ flex: 1, backgroundColor: C.bg, opacity: 0.75 }} />
        </Pressable>
        <View accessibilityViewIsModal style={{ backgroundColor: C.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderBottomWidth: 0,
          borderColor: C.fieldLine, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 + insets.bottom }}>
          <View style={[S.row, { gap: 8 }]}>
            <Text style={[S.h2, { flex: 1 }]} accessibilityRole="header">{t("app_voiceMenu")}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t("close")}
              style={({ pressed }) => [{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }, pressed && S.pressed]}>
              <Icon name="x" size={22} color={C.muted} />
            </Pressable>
          </View>
          <SwitchRow label={t("app_talkMode")} value={talk} onChange={onTalk} disabled={!canTalk}>
            <Icon name="headphones" size={22} color={C.link} />
            <View style={{ flex: 1, gap: 2, paddingVertical: 10 }}>
              <Text style={[S.body, { fontWeight: "600" }]}>{t("app_talkMode")}</Text>
              <Text style={S.muted}>{t("app_talkOn")}</Text>
            </View>
          </SwitchRow>
          {/* Beta: a live spoken conversation with the AI itself (Settings → Beta features) */}
          {beta && (
            <Pressable onPress={onCall} disabled={!canCall} accessibilityRole="button" accessibilityState={{ disabled: !canCall }}
              style={({ pressed }) => [S.row, { gap: 10, minHeight: 56, borderTopWidth: 1, borderColor: C.line }, !canCall && { opacity: 0.5 }, pressed && S.pressed]}>
              <Icon name="phone-call" size={22} color={C.link} />
              <View style={{ flex: 1, gap: 2, paddingVertical: 10 }}>
                <Text style={[S.body, { fontWeight: "600" }]}>{t("app_voiceAiStart")}</Text>
                <Text style={S.muted}>{t("app_voiceAiNote")}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={C.muted} />
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function Ask() {
  const { t, tf, lang } = useI18n();
  const { C, S } = useTheme();
  const beta = useBeta();
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [dogId, setDogId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [vet, setVet] = useState<SavedPlace | null>(null);
  const [shareFile, setShareFile] = useState(true);
  // `${dogId}:${index}` of an answer about another dog than the chosen one: "Is this about another dog?"
  const [otherDogAt, setOtherDogAt] = useState<string | null>(null);
  // The note on general advice in the "no specific dog" conversation: closed (kept on
  // the phone until that conversation is cleared), null while loading; dogs loaded once.
  const [noDogInfoClosed, setNoDogInfoClosed] = useState<boolean | null>(null);
  const [choosingDog, setChoosingDog] = useState(false);
  const [dogsLoaded, setDogsLoaded] = useState(false);
  const [voiceMenu, setVoiceMenu] = useState(false);
  useEffect(() => { kvGet("noDogInfoClosed").then((v) => setNoDogInfoClosed(v === "1")).catch(() => setNoDogInfoClosed(false)); }, []);
  const list = useRef<FlatList<ChatMessage>>(null);
  const currentDog = useRef<number | null>(null);    // for answers that arrive after a dog switch
  // What the list keeps in view as its content grows: the end (a conversation just
  // opened, a question just sent), the start of a new answer (its index: the band and
  // what to do come first), or nothing once the owner scrolls or the answer is shown.
  const follow = useRef<"end" | number | null>(null);
  const scrollRetries = useRef(0);

  // ?q= fills in a question (not sent), ?dog= picks the dog: from the walkthrough.
  const params = useLocalSearchParams<{ q?: string; dog?: string }>();
  const appliedDogParam = useRef<string | undefined>(undefined);   // tab params stick: apply once
  const dogResolved = useRef(false);   // the opening dog is known (dogs and the last choice read)
  useFocusEffect(useCallback(() => {
    myVet().then(setVet).catch(() => undefined);
    Promise.all([listDogs(), kvGet("askDog")]).then(([d, last]) => {
      setDogs(d);
      setDogsLoaded(true);
      const fromLink = params.dog && params.dog !== appliedDogParam.current ? Number(params.dog) : null;
      appliedDogParam.current = params.dog;
      // A dog asked for by a link, else the current one, else the last choice (also
      // "no specific dog"), else, for an owner who never chose, the only one.
      dogResolved.current = true;
      setDogId((cur) => openingDog(d, fromLink, cur, last));
    }).catch(() => undefined);
  }, [params.dog]));
  useEffect(() => { if (params.q) setText(String(params.q).slice(0, 1000)); }, [params.q]);
  // Whose conversation is on screen: a question handed over by the walkthrough
  // is sent only once that conversation has loaded.
  const [loadedFor, setLoadedFor] = useState<{ dog: number | null } | null>(null);
  useEffect(() => {
    currentDog.current = dogId;
    setLoadedFor(null);
    setOtherDogAt(null);
    setChoosingDog(false);
    loadChat(dogId).catch(() => [] as ChatMessage[]).then((m) => { follow.current = "end"; setMessages(m); setLoadedFor({ dog: dogId }); });
    // Remembered once the opening dog is known: the first render's "no dog" is no choice.
    if (dogResolved.current) kvSet("askDog", storedDog(dogId)).catch(() => undefined);
    if (dogId != null) shareFileWithAi(dogId).then(setShareFile).catch(() => undefined);
  }, [dogId]);

  const dog = dogs.find((d) => d.id === dogId) || null;

  // Sends the conversation. Error bubbles are local: never sent, never stored.
  const run = async (history: ChatMessage[], spoken: boolean) => {
    const askedFor = dogId;
    setBusy(true);
    const r = await ask(history.filter((m) => !m.local), lang, { emergency: t("emergencyBtn"), lost: t("lostTitle") }, dog);
    setBusy(false);
    // An error is never an assessment; after an emergency it keeps the emergency (and its button).
    const reply: ChatMessage = "error" in r
      ? { role: "assistant", local: true, urgency: r.urgency,
          content: t(r.error === "rate_limited" ? "aiRateLimited" : r.error === "unavailable" ? "aiReply" : r.error === "unreliable" ? "app_aiUnreliable" : "aiError") }
      : { role: "assistant", content: r.reply, urgency: r.urgency, topic: r.topic, sig: r.sig, parts: r.parts };
    if (!reply.local) reply.id = await addChat(askedFor, reply);   // the id: thumbs up/down right away
    // A sign the owner reported goes into the dog's file (by itself unless switched
    // off for this dog, or undone for this kind of sign in this conversation);
    // never when the answer is about another dog than the chosen one.
    const obs = reply.parts?.observation;
    const otherDog = !!reply.parts?.other_dog && askedFor != null;
    if (obs && askedFor != null && !otherDog) {
      const key = `${askedFor}:${history.length}`;
      const auto = !undoneCats.current.has(`${askedFor}:${obs.category}`) && (await autoFile(askedFor).catch(() => false));
      const id = auto ? await fileObservation(askedFor, obs).catch(() => null) : null;
      setObsState((m) => new Map(m).set(key, { obs, id }));
    }
    if (currentDog.current !== askedFor) return;   // the user switched dogs meanwhile: it's in that dog's thread
    // Show the new answer's start: its band and what to do. In an emergency the
    // keyboard goes away too, so the buttons get the screen.
    follow.current = history.length;
    scrollRetries.current = 0;
    if (reply.urgency === "emergency") Keyboard.dismiss();
    setMessages(history.concat(reply));
    if (otherDog) { setOtherDogAt(`${askedFor}:${history.length}`); AccessibilityInfo.announceForAccessibility(t("app_otherDog")); }
    else if (isLevel(reply.urgency) && !spoken && !talkRef.current) AccessibilityInfo.announceForAccessibility(t(levelKey(reply.urgency)));
    // Asked by voice: answer by voice too (hands busy with the dog), with the
    // short spoken version; in conversation mode, listen again afterwards.
    if (spoken || talkRef.current) {
      const say = reply.local ? reply.content : reply.parts?.spoken || reply.parts?.summary || reply.content;
      setSpeaking(history.length);
      speak(say, lang, () => {
        setSpeaking(null);
        // A moment for the phone to switch from speaker to microphone
        if (talkRef.current && !reply.local) setTimeout(() => { if (talkRef.current) listen(); }, 400);
        else if (reply.local) endTalk();
      });
    }
  };
  const [expanded, setExpanded] = useState<Set<number>>(new Set());   // answers shown in full
  useEffect(() => setExpanded(new Set()), [dogId]);
  // spoken: said out loud (answer out loud too); tapped: a quick reply
  const send = async (spoken?: string, tapped?: string) => {
    const content = (spoken ?? tapped ?? text).trim().slice(0, 1000);
    if (!content || busy) return;
    const user: ChatMessage = { role: "user", content };
    const history = messages.filter((m) => !m.local).concat(user);
    follow.current = "end";
    setMessages(history);
    setOtherDogAt(null);
    if (tapped == null) setText("");
    await addChat(dogId, user);
    await run(history, spoken != null);
  };
  useEffect(() => {
    if (!loadedFor || loadedFor.dog !== dogId) return;
    // An existing conversation opens at its latest message, not at the intro
    // (onContentSizeChange can fire before the list has its final layout).
    const timer = setTimeout(() => list.current?.scrollToEnd({ animated: false }), 250);
    const q = takeQuestion(dogId);
    if (q) send(undefined, q);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedFor]);
  // The last question got no answer (an error, or the app was closed): ask again.
  const lastUnanswered = !busy && messages.length > 0 && (messages[messages.length - 1].role === "user" || !!messages[messages.length - 1].local);
  const retry = () => run(messages.filter((m) => !m.local), false);

  // ---- voice ----
  // Conversation mode: after each spoken answer, listen again, until a stop
  // phrase ("stop", "bedankt"), two silences in a row, or a tap on the headset.
  // Tapping the mic while an answer is read out interrupts it and listens.
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);   // index of the message being read
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [talk, setTalk] = useState(false);
  const talkRef = useRef(false);
  const silences = useRef(0);
  const endTalk = () => { talkRef.current = false; setTalk(false); silences.current = 0; };
  useSpeechRecognitionEvent("result", (e) => {
    const said = e.results?.[0]?.transcript || "";
    setText(said);
    if (!e.isFinal || !said.trim()) return;
    setListening(false);
    silences.current = 0;
    if (talkRef.current && isStopPhrase(said, t("app_voiceStopWords"))) { endTalk(); setText(""); return; }
    send(said);
  });
  // Listening follows the recognizer's own events: starting a new session first
  // ends the previous one (iOS), and that "end" arrives after start() returns.
  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", (e) => {
    setListening(false);
    if (e.error === "no-speech" && talkRef.current) {
      if (++silences.current >= 2) endTalk(); else listen();
      return;
    }
    if ((e.error === "language-not-supported" || e.error === "service-not-allowed") && retryOnServer()) { listen(); return; }
    // The code helps when someone reports it ("not-allowed", "network", ...).
    if (e.error !== "no-speech" && e.error !== "aborted") { setVoiceNote(`${t("app_voiceUnavailable")} (${e.error})`); endTalk(); }
  });
  const listen = async () => {
    setVoiceNote(null);
    stopSpeaking(); setSpeaking(null);
    const problem = await startListening(lang);
    if (problem) { setVoiceNote(problem === "denied" ? t("app_voiceDenied") : `${t("app_voiceUnavailable")} (unavailable)`); endTalk(); }
    else setText("");
  };
  const toggleListening = () => {
    if (listening) { stopListening(); return; }
    listen();
  };
  const toggleTalk = () => {
    if (talkRef.current) { endTalk(); stopListening(); stopSpeaking(); setSpeaking(null); return; }
    talkRef.current = true; setTalk(true); silences.current = 0;
    listen();
  };
  const toggleRead = (i: number, content: string) => {
    if (speaking === i) { stopSpeaking(); setSpeaking(null); return; }
    setSpeaking(i);
    speak(content, lang, () => setSpeaking((cur) => (cur === i ? null : cur)));
  };
  useFocusEffect(useCallback(() => () => { talkRef.current = false; setTalk(false); setVoiceMenu(false); stopSpeaking(); stopListening(); }, []));

  // The headset sheet's choices act once the sheet has gone (a new screen or the
  // microphone while a modal is still closing is asking for trouble on iOS).
  const afterSheet = (fn: () => void) => { setVoiceMenu(false); setTimeout(fn, 300); };
  const startCall = () => {
    // The phone's own speech recognition lets go of the microphone first.
    if (talkRef.current || listening) { endTalk(); stopListening(); stopSpeaking(); setSpeaking(null); }
    router.push({ pathname: "/voice", params: dogId != null ? { dog: String(dogId) } : {} });
  };

  // "Save to the dog's file": the question as title, the answer as details.
  // Keyed by message id, so a remount or dog switch can't save it twice.
  const [filed, setFiled] = useState<Set<string>>(new Set());
  const fileKey = (m: ChatMessage, i: number) => String(m.id ?? `${dogId}:${i}:${m.content.length}`);
  const saveToFile = async (m: ChatMessage, i: number) => {
    if (!dog) return;
    const question = messages.slice(0, i).reverse().find((x) => x.role === "user");
    // The verdict and steps read better in the file than the long answer.
    const details = m.parts?.summary
      ? [m.parts.summary, ...m.parts.steps.map((s, n) => `${n + 1}. ${s}`)].join("\n")
      : m.content;
    await addRecord({ dogId: dog.id, kind: "ai", date: today(), title: (question ? question.content : t("app_rec_ai")).slice(0, 200), details, value: null });
    setFiled((s) => new Set(s).add(fileKey(m, i)));
  };

  // Observations of this session's answers, by `${dogId}:${index}`: id = the file entry, null = not filed.
  const [obsState, setObsState] = useState<Map<string, { obs: Observation; id: number | null }>>(new Map());
  const undoneCats = useRef<Set<string>>(new Set());
  const undoObs = async (key: string) => {
    const s = obsState.get(key);
    if (!s || s.id == null || dogId == null) return;
    await deleteRecordById(s.id).catch(() => undefined);
    undoneCats.current.add(`${dogId}:${s.obs.category}`);
    setObsState((m) => new Map(m).set(key, { ...s, id: null }));
  };
  const addObs = async (key: string) => {
    const s = obsState.get(key);
    if (!s || dogId == null) return;
    undoneCats.current.delete(`${dogId}:${s.obs.category}`);
    const id = await fileObservation(dogId, s.obs).catch(() => null);
    setObsState((m) => new Map(m).set(key, { ...s, id }));
  };

  // "Is this about another dog?": that dog's own conversation opens, with the
  // question filled in (not sent: the owner checks it, it may need more words).
  const switchDog = (id: number | null) => {
    const q = lastQuestion(messages);
    setDogId(id);
    if (q && !text.trim()) setText(q);
  };

  const closeNoDogInfo = () => { setNoDogInfoClosed(true); kvSet("noDogInfoClosed", "1").catch(() => undefined); };
  const newChat = () => Alert.alert(t("app_newChatConfirm"), undefined, [
    { text: t("app_cancel"), style: "cancel" },
    { text: t("app_newChat"), style: "destructive", onPress: async () => {
      await clearChat(dogId); setMessages([]); setObsState(new Map());
      // A cleared "no specific dog" conversation starts with the note on general advice again.
      if (dogId == null) { setNoDogInfoClosed(false); kvSet("noDogInfoClosed", null).catch(() => undefined); }
    } }
  ]);

  // The navigation header: the headset (voice options) and New chat. The buttons
  // call the latest handlers through a ref, so the header only changes with what it shows.
  const header = useRef({ newChat, openVoice: () => setVoiceMenu(true) });
  header.current = { newChat, openVoice: () => setVoiceMenu(true) };
  const hasChat = messages.length > 0;
  const headerOptions = useMemo(() => ({
    headerLeft: () => <HeaderButton icon="headphones" label={t("app_voiceMenu")} on={talk} expanded={voiceMenu} onPress={() => header.current.openVoice()} />,
    headerRight: () => (hasChat ? <HeaderButton icon="edit-3" label={t("app_newChat")} onPress={() => header.current.newChat()} /> : null)
  }), [t, talk, voiceMenu, hasChat]);

  // What to do next: call your own vet first, then find one / a trainer.
  const actions = (m: ChatMessage) => {
    const out: NextStep[] = [];
    const health = m.topic !== "behaviour";
    if (health && (m.urgency === "emergency" || m.urgency === "vet_today" || m.urgency === "vet_soon") && vet?.phone) {
      out.push({ label: tf("app_callMyVet", { name: vet.name || t("app_myVet") }), icon: (c) => <Icon name="phone" size={20} color={c} />,
        go: () => Linking.openURL(callUrl(vet.phone!)), danger: m.urgency === "emergency" });
    }
    // Only when it's needed: home advice ("monitor") gets no referral buttons;
    // its warning signs say when to get help.
    if (m.urgency === "emergency") out.push({ label: withoutEmoji(t("aiCtaEmergency")), icon: (c) => <Icon name="map-pin" size={20} color={c} />, go: () => router.push("/emergency"), danger: true });
    // A lost or found dog: the app's own guide (first steps, the official registers).
    else if (m.topic === "lost") out.push({ label: withoutEmoji(t("aiCtaLost")), icon: (c) => <Icon name="search" size={20} color={c} />, go: () => router.push("/lost") });
    else if (m.urgency === "vet_soon" || m.urgency === "vet_today") {
      if (m.topic === "behaviour") out.push({ label: withoutEmoji(t("aiCtaTrainers")), icon: (c) => <Symbol name="school-outline" size={20} color={c} />,
        go: () => router.push({ pathname: "/", params: { cat: "training" } }) });
      else if (!vet) out.push({ label: withoutEmoji(t("aiCtaVets")), icon: (c) => <Symbol name="stethoscope" size={20} color={c} />,
        go: () => router.push({ pathname: "/", params: { cat: "vet" } }) });
    }
    return out;
  };

  const closeButton = (onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t("close")}
      style={({ pressed }) => [{ width: 44, height: 44, marginVertical: -10, marginRight: -10, alignItems: "center", justifyContent: "center" }, pressed && S.pressed]}>
      <Icon name="x" size={18} color={C.muted} />
    </Pressable>
  );

  const intro = (
    <View style={{ gap: 10, marginBottom: 8 }}>
      <View style={[S.card, { gap: 6 }]}>
        <Text style={S.body}>{t("aiIntro")}</Text>
        <View style={[S.row, { gap: 6, alignItems: "flex-start" }]}>
          <Symbol name="robot-outline" size={16} color={C.muted} style={{ marginTop: 1 }} />
          <Text style={[S.muted, { flex: 1, fontWeight: "600" }]}>{t("app_aiIsAI")}</Text>
        </View>
        <Text style={S.muted}>{t("aiDisclaimer")}</Text>
      </View>
      <Pressable onPress={() => router.push("/emergency")} accessibilityRole="button"
        style={({ pressed }) => [S.card, S.row, { gap: 8, backgroundColor: C.alertBg, borderColor: C.alertLine }, pressed && S.pressed]}>
        <Icon name="alert-octagon" size={20} color={C.danger} />
        <Text style={[S.body, { flex: 1, color: C.alertText }]}>{t("app_aiEmergencyLine")}</Text>
        <Text style={{ color: C.danger, fontWeight: "700" }}>{t("emergencyBtn")}</Text>
        <Icon name="chevron-right" size={18} color={C.danger} />
      </Pressable>
      {/* No dog chosen (or none added yet): the advice is general. After the emergency line,
          never in the way of a question. */}
      {dogsLoaded && dogId == null && noDogInfoClosed === false && (
        <View style={[S.card, { gap: 8 }]}>
          <View style={[S.row, { gap: 8, alignItems: "flex-start" }]}>
            <Symbol name="dog" size={20} color={C.muted} />
            <Text style={[S.body, { flex: 1 }]}>{t("app_noDogInfo")}</Text>
            {closeButton(closeNoDogInfo)}
          </View>
          {dogs.length > 0 ? (
            <>
              <Pressable onPress={() => setChoosingDog((c) => !c)} accessibilityRole="button" accessibilityState={{ expanded: choosingDog }}
                style={({ pressed }) => [S.btnGhost, S.row, { gap: 6, alignSelf: "flex-start", minHeight: 44 }, pressed && S.pressed]}>
                <Symbol name="dog" size={18} />
                <Text style={S.btnGhostText}>{t("app_chooseDog")}</Text>
                <Icon name={choosingDog ? "chevron-up" : "chevron-down"} size={18} />
              </Pressable>
              {choosingDog && <DogChips options={otherDogOptions(dogs, null, t("app_noDog"))} onChange={setDogId} />}
            </>
          ) : (
            <Pressable onPress={() => router.push({ pathname: "/dog/[id]", params: { id: "new" } })} accessibilityRole="button"
              style={({ pressed }) => [S.btnGhost, S.row, { gap: 6, alignSelf: "flex-start", minHeight: 44 }, pressed && S.pressed]}>
              <Icon name="plus" size={18} />
              <Text style={S.btnGhostText}>{t("app_addDog")}</Text>
            </Pressable>
          )}
        </View>
      )}
      {messages.length === 0 && (
        <View style={{ gap: 8 }}>
          <Text style={S.muted}>{t("app_aiTryAsking")}</Text>
          {starters(dog).map((k) => (
            <Pressable key={k} onPress={() => send(undefined, t(k))} disabled={busy} accessibilityRole="button"
              style={({ pressed }) => [S.card, S.row, { gap: 10, minHeight: 44, paddingVertical: 10 }, pressed && S.pressed]}>
              <Icon name="message-circle" size={18} color={C.link} />
              <Text style={[S.body, { flex: 1 }]}>{t(k)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  // A small action under an answer (Read aloud, Save to the file): 44 px high.
  const small = (icon: IconName, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [S.row, { gap: 6, minHeight: 44, paddingHorizontal: 8 }, pressed && S.pressed]}>
      <Icon name={icon} size={18} color={C.link} />
      <Text style={{ flexShrink: 1, color: C.link, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Tabs.Screen options={headerOptions} />
      {dogs.length > 0 && (
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
          {/* Which dog this conversation is about (each dog has its own), and, for a dog,
              whether its file goes along: switchable right here. */}
          <DogSwitcher dogs={dogs} value={dogId} onChange={setDogId}>
            {dog && (
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <SwitchRow label={tf("app_aiUseFile", { name: dog.name })} value={shareFile}
                  onChange={async (on) => { setShareFile(on); await setShareFileWithAi(dog.id, on).catch(() => undefined); }}>
                  <Text style={[S.muted, { flexShrink: 1, fontWeight: "600", textAlign: "right" }]}>{tf("app_aiUseFile", { name: dog.name })}</Text>
                </SwitchRow>
              </View>
            )}
          </DogSwitcher>
        </View>
      )}
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m, i) => String(m.id ?? "x" + i)}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        onScrollBeginDrag={() => { follow.current = null; }}
        onContentSizeChange={() => {
          // A new answer: show its start (band and what to do first), not its end, and
          // keep it there (thumbs and notes that load afterwards don't scroll it away).
          // The size can also change before the answer is in the list (with voice, the
          // "listening" line goes away): then wait, an index past the end crashes.
          const at = follow.current;
          if (at === "end") list.current?.scrollToEnd({ animated: true });
          else if (at != null && at < messages.length) { follow.current = null; list.current?.scrollToIndex({ index: at, viewPosition: 0, viewOffset: 8, animated: true }); }
        }}
        onScrollToIndexFailed={(info) => {
          // Not measured yet: get close, then try again (never to the end: that hides the band).
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          if (scrollRetries.current++ < 4) setTimeout(() => list.current?.scrollToIndex({ index: info.index, viewPosition: 0, viewOffset: 8, animated: true }), 120);
        }}
        ListHeaderComponent={intro}
        renderItem={({ item: m, index: i }) => {
          if (m.role === "user") {
            return (
              <View style={{ alignSelf: "flex-end", maxWidth: "85%", backgroundColor: C.brandDark, borderRadius: 16, borderBottomRightRadius: 4, paddingVertical: 10, paddingHorizontal: 12 }}>
                <Text style={[S.body, { color: C.onBrand }]}>{m.content}</Text>
              </View>
            );
          }
          const next = !m.local || m.urgency === "emergency" ? actions(m) : [];
          const level = isLevel(m.urgency) ? m.urgency : null;
          const structured = !!m.parts && !expanded.has(i);
          return (
            <View style={{ gap: 8 }}>
              <View style={{ backgroundColor: m.local ? C.noteBg : C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, overflow: "hidden" }}>
                {/* The level first, in its colour and with its own icon; an answer without one still says what it is */}
                {level ? <UrgencyBand level={level} /> : !m.local && <AssessmentNote />}
                {/* What to do, before the advice */}
                {next.length > 0 && (
                  <View style={{ gap: 8, paddingHorizontal: 14, paddingTop: 12 }}>
                    {next.map((a, n) => <NextButton key={a.label} step={a} first={n === 0} />)}
                  </View>
                )}
                <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: structured ? 0 : 12 }}>
                  {m.parts && structured ? <Answer parts={m.parts} onFull={() => { follow.current = null; setExpanded((s) => new Set(s).add(i)); }} />
                    : <Text style={S.body}>{m.content}</Text>}
                </View>
                {!m.local && (
                  <View style={[S.row, { flexWrap: "wrap", gap: 2, paddingHorizontal: 6, borderTopWidth: 1, borderColor: C.line }]}>
                    {small(speaking === i ? "square" : "volume-2", t(speaking === i ? "app_stopReading" : "app_readAloud"), () => toggleRead(i, m.content))}
                    {dog && m.urgency && (
                      filed.has(fileKey(m, i))
                        ? (
                          <View style={[S.row, { gap: 6, minHeight: 44, paddingHorizontal: 8 }]}>
                            <Icon name="check" size={18} color={C.ok} />
                            <Text style={{ flexShrink: 1, color: C.ok, fontSize: 14, fontWeight: "600" }}>{t("app_savedToFile")}</Text>
                          </View>
                        )
                        : small("folder-plus", tf("app_saveToFile", { name: dog.name }), () => saveToFile(m, i))
                    )}
                    <View style={{ flexGrow: 1 }} />
                    {m.id != null && <Rating id={m.id} />}
                  </View>
                )}
              </View>
              {/* The owner talks about another dog than the chosen one: offer that dog's own conversation */}
              {otherDogAt === `${dogId}:${i}` && (
                <View style={[S.card, { gap: 8, paddingVertical: 10, backgroundColor: C.chip }]}>
                  <View style={[S.row, { gap: 8 }]}>
                    <Symbol name="paw" size={18} color={C.muted} />
                    <Text style={[S.body, { flex: 1, fontWeight: "600" }]} accessibilityRole="header">{t("app_otherDog")}</Text>
                    {closeButton(() => setOtherDogAt(null))}
                  </View>
                  <DogChips options={otherDogOptions(dogs, dogId, t("app_noDog"))} onChange={switchDog}>
                    <Pressable onPress={() => router.push({ pathname: "/dog/[id]", params: { id: "new" } })} accessibilityRole="button"
                      style={({ pressed }) => [S.row, { gap: 6, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22, borderWidth: 1, borderColor: C.link, backgroundColor: C.card }, pressed && S.pressed]}>
                      <Icon name="plus" size={16} color={C.link} />
                      <Text style={{ color: C.link, fontWeight: "600" }}>{t("app_addDog")}</Text>
                    </Pressable>
                  </DogChips>
                </View>
              )}
              {/* Tap-to-answer replies for the latest answer's first question */}
              {i === messages.length - 1 && !busy && !!m.parts?.quick_replies.length && (
                <View style={[S.row, { gap: 6, flexWrap: "wrap" }]}>
                  {m.parts.quick_replies.map((q) => (
                    <Pressable key={q} onPress={() => send(undefined, q)} accessibilityRole="button"
                      style={({ pressed }) => [{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, borderWidth: 1, borderColor: C.link, backgroundColor: C.card }, pressed && S.pressed]}>
                      <Text style={{ color: C.link, fontWeight: "600" }}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {/* The sign noted for the dog's file: filed (undo) or ready to add */}
              {dog && (() => {
                const key = `${dogId}:${i}`, s = obsState.get(key);
                if (!s) return null;
                return (
                  <View style={[S.card, S.row, { gap: 8, paddingVertical: 4, backgroundColor: C.chip }]}>
                    <Icon name={s.id != null ? "check" : "file-plus"} size={16} color={s.id != null ? C.ok : C.muted} />
                    <Text style={[S.muted, { flex: 1 }]} numberOfLines={2}>
                      {tf(s.id != null ? "app_obsFiled" : "app_obsAdd", { name: dog.name })}: <Text style={{ fontWeight: "700", color: C.text }}>{s.obs.title}</Text> · {formatDate(s.obs.date, lang)}
                    </Text>
                    <Pressable onPress={() => (s.id != null ? undoObs(key) : addObs(key))} accessibilityRole="button"
                      style={({ pressed }) => [{ minHeight: 44, justifyContent: "center", paddingHorizontal: 6 }, pressed && S.pressed]}>
                      <Text style={{ color: C.link, fontWeight: "600" }}>{t(s.id != null ? "app_undo" : "app_add")}</Text>
                    </Pressable>
                  </View>
                );
              })()}
            </View>
          );
        }}
        ListFooterComponent={busy ? <ActivityIndicator color={C.brand} style={{ marginTop: 8 }} />
          : lastUnanswered ? (
            <Pressable onPress={retry} accessibilityRole="button"
              style={({ pressed }) => [S.btnGhost, S.row, { gap: 6, alignSelf: "flex-start", minHeight: 44 }, pressed && S.pressed]}>
              <Icon name="refresh-cw" size={16} />
              <Text style={S.btnGhostText}>{t("app_retry")}</Text>
            </Pressable>
          ) : undefined}
      />
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
        {/* Conversation mode is on: what it does, and the headset to end it */}
        {talk && (
          <View style={[S.row, { gap: 8 }]}>
            <Text style={[S.muted, { flex: 1, color: C.link, fontWeight: "600" }]} accessibilityLiveRegion="polite">{t("app_talkOn")}</Text>
            <Pressable onPress={toggleTalk} accessibilityRole="switch" accessibilityState={{ checked: true }} accessibilityLabel={t("app_talkMode")}
              style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.brandDark }, pressed && S.pressed]}>
              <Icon name="headphones" size={20} color={C.onBrand} />
            </Pressable>
          </View>
        )}
        {listening && (
          <View style={[S.row, { gap: 6 }]}>
            <Icon name="mic" size={16} color={C.danger} />
            <Text style={[S.muted, { flex: 1, color: C.danger, fontWeight: "700" }]} accessibilityLiveRegion="polite">{t("app_voiceListening")}</Text>
          </View>
        )}
        {!!voiceNote && <Text style={[S.muted, { color: C.warn }]}>{voiceNote}</Text>}
        {/* One row: the field with the mic inside, and a round Send */}
        <View style={[S.row, { gap: 8, alignItems: "flex-end" }]}>
          <View style={{ flex: 1, minHeight: 44, flexDirection: "row", alignItems: "flex-end", borderWidth: 1, borderColor: C.fieldLine, borderRadius: 22, backgroundColor: C.card, paddingLeft: 14 }}>
            <Input style={{ flex: 1, minHeight: 42, maxHeight: 120, paddingHorizontal: 0, paddingTop: 11, paddingBottom: 11, fontSize: 16, color: C.text }}
              value={text} onChangeText={setText} placeholder={t("aiPlaceholder")} multiline maxLength={1000} />
            <Pressable onPress={toggleListening} disabled={busy} accessibilityRole="button" accessibilityLabel={t(listening ? "app_voiceListening" : "app_voiceStart")}
              accessibilityState={{ disabled: busy }}
              style={({ pressed }) => [{ width: 44, height: 42, alignItems: "center", justifyContent: "center" }, busy && { opacity: 0.5 }, pressed && S.pressed]}>
              {listening
                ? <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.dangerFill }}><Icon name="square" size={14} color={C.onBrand} /></View>
                : <Icon name="mic" size={22} color={C.muted} />}
            </Pressable>
          </View>
          <Pressable onPress={() => send()} disabled={busy} accessibilityRole="button" accessibilityLabel={t("aiSend")} accessibilityState={{ disabled: busy }}
            style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.brandDark }, busy && { opacity: 0.5 }, pressed && S.pressed]}>
            <Icon name="arrow-up" size={22} color={C.onBrand} />
          </Pressable>
        </View>
      </View>
      <VoiceSheet visible={voiceMenu} onClose={() => setVoiceMenu(false)}
        talk={talk} canTalk={!busy || talk} onTalk={() => afterSheet(toggleTalk)}
        beta={beta.voice} canCall={!busy} onCall={() => afterSheet(startCall)} />
    </KeyboardAvoidingView>
  );
}
