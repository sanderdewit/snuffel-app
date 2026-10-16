// AI help with health and behaviour. With a dog chosen, its profile (and, if
// the owner allows it, a summary of its file) goes along so the advice fits
// that dog. Each dog has its own conversation, kept on the phone.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../i18n";
import { addChat, ask, clearChat, loadChat, type AnswerParts, type ChatMessage } from "../../lib/ai";
import { kvGet, kvSet } from "../../lib/db";
import { ageMonths, listDogs, today, type Dog } from "../../lib/dogs";
import { addRecord, setShareFileWithAi, shareFileWithAi } from "../../lib/dogfile";
import { myVet, type SavedPlace } from "../../lib/saved";
import { speak, startListening, stopListening, stopSpeaking } from "../../lib/voice";
import { isStopPhrase } from "../../lib/talk";
import { takeQuestion } from "../../lib/handoff";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import { callUrl } from "../../ui/PlaceCard";
import { Toggle } from "../../ui/Toggle";
import { C, S } from "../../ui/theme";

const MONITOR = "#1d4ed8";   // "keep an eye on it": not green, which reads as "all fine"

// Example questions for an empty conversation; a puppy gets house-training first.
function starters(dog: Dog | null): string[] {
  const months = dog ? ageMonths(dog.birth) : null;
  return months != null && months < 12
    ? ["app_aiStarter4", "app_aiStarter1", "app_aiStarter3", "app_aiStarter5"]
    : ["app_aiStarter1", "app_aiStarter3", "app_aiStarter2", "app_aiStarter5"];
}

// A structured answer: the verdict first (readable in five seconds), then the
// steps, the signs to get help sooner, and the follow-up questions.
function Answer({ parts, onFull }: { parts: AnswerParts; onFull: () => void }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 8 }}>
      {!!parts.summary && <Text style={[S.body, { fontWeight: "700" }]}>{parts.summary}</Text>}
      {parts.steps.map((s, n) => (
        <View key={n} style={[S.row, { gap: 8, alignItems: "flex-start" }]}>
          <Text style={[S.body, { fontWeight: "700", color: C.brandDark, minWidth: 16 }]}>{n + 1}.</Text>
          <Text style={[S.body, { flex: 1 }]}>{s}</Text>
        </View>
      ))}
      {parts.watch_for.length > 0 && (
        <View style={{ gap: 2, marginTop: 2 }}>
          <Text style={[S.muted, { fontWeight: "700", color: C.warn }]}>⚠️ {t("app_aiWatchFor")}</Text>
          {parts.watch_for.map((w, n) => <Text key={n} style={S.body}>• {w}</Text>)}
        </View>
      )}
      {parts.questions.map((q, n) => <Text key={n} style={[S.body, { fontStyle: "italic" }]}>{q}</Text>)}
      <Pressable onPress={onFull} hitSlop={8} accessibilityRole="button">
        <Text style={[S.muted, { textDecorationLine: "underline" }]}>{t("app_aiFullAnswer")}</Text>
      </Pressable>
    </View>
  );
}

export default function Ask() {
  const { t, tf, lang } = useI18n();
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [dogId, setDogId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [vet, setVet] = useState<SavedPlace | null>(null);
  const [shareFile, setShareFile] = useState(true);
  const list = useRef<FlatList<ChatMessage>>(null);
  const currentDog = useRef<number | null>(null);    // for answers that arrive after a dog switch
  const scrollTo = useRef<number | null>(null);      // index of a new answer: show its start

  // ?q= fills in a question (not sent), ?dog= picks the dog: from the walkthrough.
  const params = useLocalSearchParams<{ q?: string; dog?: string }>();
  const appliedDogParam = useRef<string | undefined>(undefined);   // tab params stick: apply once
  useFocusEffect(useCallback(() => {
    myVet().then(setVet).catch(() => undefined);
    Promise.all([listDogs(), kvGet("askDog")]).then(([d, last]) => {
      setDogs(d);
      const fromLink = params.dog && params.dog !== appliedDogParam.current ? Number(params.dog) : null;
      appliedDogParam.current = params.dog;
      // A dog asked for by a link, else the current one, else the last one used, else the only one.
      setDogId((cur) => {
        for (const id of [fromLink, cur, last ? Number(last) : null]) if (id != null && d.some((x) => x.id === id)) return id;
        return d.length === 1 ? d[0].id : null;
      });
    }).catch(() => undefined);
  }, [params.dog]));
  useEffect(() => { if (params.q) setText(String(params.q).slice(0, 1000)); }, [params.q]);
  // Whose conversation is on screen: a question handed over by the walkthrough
  // is sent only once that conversation has loaded.
  const [loadedFor, setLoadedFor] = useState<{ dog: number | null } | null>(null);
  useEffect(() => {
    currentDog.current = dogId;
    setLoadedFor(null);
    loadChat(dogId).catch(() => [] as ChatMessage[]).then((m) => { setMessages(m); setLoadedFor({ dog: dogId }); });
    kvSet("askDog", dogId == null ? null : String(dogId)).catch(() => undefined);
    if (dogId != null) shareFileWithAi(dogId).then(setShareFile).catch(() => undefined);
  }, [dogId]);

  const dog = dogs.find((d) => d.id === dogId) || null;

  // Sends the conversation. Error bubbles are local: never sent, never stored.
  const run = async (history: ChatMessage[], spoken: boolean) => {
    const askedFor = dogId;
    setBusy(true);
    const r = await ask(history.filter((m) => !m.local), lang, t("emergencyBtn"), dog);
    setBusy(false);
    const reply: ChatMessage = "error" in r
      ? { role: "assistant", local: true, content: t(r.error === "rate_limited" ? "aiRateLimited" : r.error === "unavailable" ? "aiReply" : "aiError") }
      : { role: "assistant", content: r.reply, urgency: r.urgency, topic: r.topic, sig: r.sig, parts: r.parts };
    if (!reply.local) await addChat(askedFor, reply);
    if (currentDog.current !== askedFor) return;   // the user switched dogs meanwhile: it's in that dog's thread
    scrollTo.current = history.length;
    setMessages(history.concat(reply));
    // Asked by voice: answer by voice too (hands busy with the dog), with the
    // short spoken version; in conversation mode, listen again afterwards.
    if (spoken || talkRef.current) {
      const say = reply.local ? reply.content : reply.parts?.spoken || reply.parts?.summary || reply.content;
      setSpeaking(history.length);
      speak(say, lang, () => {
        setSpeaking(null);
        if (talkRef.current && !reply.local) listen();
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
    setMessages(history);
    if (tapped == null) setText("");
    await addChat(dogId, user);
    await run(history, spoken != null);
  };
  useEffect(() => {
    if (!loadedFor || loadedFor.dog !== dogId) return;
    const q = takeQuestion(dogId);
    if (q) send(undefined, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedFor]);
  // The last question got no answer (an error, or the app was closed): ask again.
  const lastUnanswered = !busy && messages.length > 0 && (messages[messages.length - 1].role === "user" || !!messages[messages.length - 1].local);
  const retry = () => run(messages.filter((m) => !m.local), false);

  // ---- voice ----
  // Conversation mode: after each spoken answer, listen again, until a stop
  // phrase ("stop", "bedankt"), two silences in a row, or a tap on 🎧.
  // Tapping 🎙️ while an answer is read out interrupts it and listens.
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);   // index of the message being read
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [talk, setTalk] = useState(false);
  const talkRef = useRef(false);
  const silences = useRef(0);
  const endTalk = () => { talkRef.current = false; setTalk(false); silences.current = 0; };
  useSpeechRecognitionEvent("result", (e) => {
    const said = e.results[0]?.transcript || "";
    setText(said);
    if (!e.isFinal || !said.trim()) return;
    setListening(false);
    silences.current = 0;
    if (talkRef.current && isStopPhrase(said, t("app_voiceStopWords"))) { endTalk(); setText(""); return; }
    send(said);
  });
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", (e) => {
    setListening(false);
    if (e.error === "no-speech" && talkRef.current) {
      if (++silences.current >= 2) endTalk(); else listen();
      return;
    }
    if (e.error !== "no-speech" && e.error !== "aborted") { setVoiceNote(t("app_voiceUnavailable")); endTalk(); }
  });
  const listen = async () => {
    setVoiceNote(null);
    stopSpeaking(); setSpeaking(null);
    const problem = await startListening(lang);
    if (problem) { setVoiceNote(t(problem === "denied" ? "app_voiceDenied" : "app_voiceUnavailable")); endTalk(); }
    else { setText(""); setListening(true); }
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
  useFocusEffect(useCallback(() => () => { talkRef.current = false; setTalk(false); stopSpeaking(); stopListening(); }, []));

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

  const newChat = () => Alert.alert(t("app_newChatConfirm"), undefined, [
    { text: t("app_cancel"), style: "cancel" },
    { text: t("app_newChat"), style: "destructive", onPress: async () => { await clearChat(dogId); setMessages([]); } }
  ]);

  // What to do next: call your own vet first, then find one / a trainer.
  const actions = (m: ChatMessage) => {
    const out: { label: string; go: () => void; danger?: boolean }[] = [];
    const health = m.topic !== "behaviour";
    if (health && (m.urgency === "emergency" || m.urgency === "vet_soon") && vet?.phone) {
      out.push({ label: "📞 " + tf("app_callMyVet", { name: vet.name || t("app_myVet") }), go: () => Linking.openURL(callUrl(vet.phone!)), danger: m.urgency === "emergency" });
    }
    // Only when it's needed: home advice ("monitor") gets no referral buttons;
    // its warning signs say when to get help.
    if (m.urgency === "emergency") out.push({ label: t("aiCtaEmergency"), go: () => router.push("/emergency"), danger: !vet?.phone });
    else if (m.urgency === "vet_soon") {
      if (m.topic === "behaviour") out.push({ label: t("aiCtaTrainers"), go: () => router.push({ pathname: "/", params: { cat: "training" } }) });
      else if (!vet) out.push({ label: t("aiCtaVets"), go: () => router.push({ pathname: "/", params: { cat: "vet" } }) });
    }
    return out;
  };

  const intro = (
    <View style={{ gap: 10, marginBottom: 8 }}>
      <View style={[S.card, { gap: 6 }]}>
        <Text style={S.body}>{t("aiIntro")}</Text>
        <Text style={[S.muted, { fontWeight: "600" }]}>🤖 {t("app_aiIsAI")}</Text>
      </View>
      <Pressable onPress={() => router.push("/emergency")} accessibilityRole="button"
        style={[S.card, S.row, { gap: 8, backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
        <Text style={[S.body, { flex: 1, color: "#7f1d1d" }]}>🚨 {t("app_aiEmergencyLine")}</Text>
        <Text style={{ color: C.danger, fontWeight: "700" }}>{t("emergencyBtn")} ›</Text>
      </Pressable>
      {dogs.length === 0 && (
        <Pressable onPress={() => router.push({ pathname: "/dog/[id]", params: { id: "new" } })} accessibilityRole="button" style={[S.card, S.row, { gap: 8 }]}>
          <Text style={{ fontSize: 22 }}>🐶</Text>
          <Text style={[S.body, { flex: 1 }]}>{t("app_aiAddDog")}</Text>
          <Text style={{ color: C.muted, fontSize: 20 }}>›</Text>
        </Pressable>
      )}
      {messages.length === 0 && (
        <View style={{ gap: 8 }}>
          <Text style={S.muted}>{t("app_aiTryAsking")}</Text>
          {starters(dog).map((k) => (
            <Pressable key={k} onPress={() => send(undefined, t(k))} disabled={busy} accessibilityRole="button" style={[S.card, S.row, { gap: 8, paddingVertical: 10 }]}>
              <Text>💬</Text>
              <Text style={[S.body, { flex: 1 }]}>{t(k)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {dogs.length > 0 && (
        <View style={{ borderBottomWidth: 1, borderColor: C.line }}>
          <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center" }} showsHorizontalScrollIndicator={false}>
            <Text style={S.muted}>{t("app_askFor")}:</Text>
            {[{ id: null as number | null, name: t("app_noDog") }].concat(dogs).map((d) => (
              <Pressable key={String(d.id)} onPress={() => setDogId(d.id)} accessibilityRole="radio" accessibilityState={{ selected: dogId === d.id }}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: dogId === d.id ? C.brandDark : C.chip }}>
                <Text style={{ color: dogId === d.id ? "#fff" : C.text }}>{d.id != null ? "🐕 " : ""}{d.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {/* What goes along with the question, switchable right here. */}
          {dog && (
            <View style={[S.row, { gap: 8, paddingHorizontal: 12, paddingBottom: 8 }]}>
              <Text style={[S.muted, { flex: 1 }]}>{tf("app_aiUses", { name: dog.name })} · {t("app_shareWithAi")}</Text>
              <Toggle value={shareFile} onValueChange={async (on) => { setShareFile(on); await setShareFileWithAi(dog.id, on); }} />
            </View>
          )}
        </View>
      )}
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m, i) => String(m.id ?? "x" + i)}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => {
          // A new answer: show its start (urgency first), not its end.
          if (scrollTo.current != null) { list.current?.scrollToIndex({ index: scrollTo.current, viewPosition: 0, animated: true }); scrollTo.current = null; }
          else list.current?.scrollToEnd({ animated: true });
        }}
        onScrollToIndexFailed={() => list.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={intro}
        renderItem={({ item: m, index: i }) => {
          const next = m.role === "assistant" && !m.local ? actions(m) : [];
          return (
            <View style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", gap: 6 }}>
              {m.urgency && m.urgency !== "unclear" && (
                <Text style={{ fontWeight: "700", color: m.urgency === "emergency" ? C.danger : m.urgency === "vet_soon" ? C.warn : MONITOR }}>
                  {t("urgency_" + m.urgency)}
                </Text>
              )}
              <View style={{ backgroundColor: m.role === "user" ? C.brandDark : m.local ? "#fff7ed" : C.card, borderRadius: 14, padding: 10, borderWidth: m.role === "user" ? 0 : 1, borderColor: C.line }}>
                {m.parts && !expanded.has(i) ? <Answer parts={m.parts} onFull={() => setExpanded((s) => new Set(s).add(i))} />
                  : <Text style={[S.body, { color: m.role === "user" ? "#fff" : C.text }]}>{m.content}</Text>}
              </View>
              {/* Tap-to-answer replies for the latest answer's first question */}
              {m.role === "assistant" && i === messages.length - 1 && !busy && !!m.parts?.quick_replies.length && (
                <View style={[S.row, { gap: 6, flexWrap: "wrap" }]}>
                  {m.parts.quick_replies.map((q) => (
                    <Pressable key={q} onPress={() => send(undefined, q)} accessibilityRole="button"
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: C.brandDark, backgroundColor: C.card }}>
                      <Text style={{ color: C.brandDark, fontWeight: "600" }}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {m.role === "assistant" && !m.local && (
                <View style={[S.row, { gap: 16, flexWrap: "wrap" }]}>
                  <Pressable onPress={() => toggleRead(i, m.content)} hitSlop={8} accessibilityRole="button"
                    accessibilityLabel={t(speaking === i ? "app_stopReading" : "app_readAloud")}>
                    <Text style={{ color: C.brandDark, fontWeight: "600" }}>{speaking === i ? "⏹ " + t("app_stopReading") : "🔊 " + t("app_readAloud")}</Text>
                  </Pressable>
                  {dog && m.urgency && (
                    filed.has(fileKey(m, i))
                      ? <Text style={{ color: C.ok, fontWeight: "600" }}>✓ {t("app_savedToFile")}</Text>
                      : <Pressable onPress={() => saveToFile(m, i)} hitSlop={8} accessibilityRole="button">
                          <Text style={{ color: C.brandDark, fontWeight: "600" }}>📁 {tf("app_saveToFile", { name: dog.name })}</Text>
                        </Pressable>
                  )}
                </View>
              )}
              {next.map((a) => (
                <Pressable key={a.label} style={[S.btn, a.danger && { backgroundColor: C.danger }]} onPress={a.go} accessibilityRole="button">
                  <Text style={S.btnText}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          );
        }}
        ListFooterComponent={busy ? <ActivityIndicator color={C.brand} style={{ marginTop: 8 }} />
          : lastUnanswered ? (
            <Pressable style={[S.btnGhost, { alignSelf: "flex-start" }]} onPress={retry} accessibilityRole="button">
              <Text style={S.btnGhostText}>↻ {t("app_retry")}</Text>
            </Pressable>
          ) : null}
      />
      <View style={{ padding: 12, gap: 6, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
        {talk && <Text style={[S.muted, { color: C.brandDark, fontWeight: "600" }]} accessibilityLiveRegion="polite">🎧 {t("app_talkOn")}</Text>}
        {listening && <Text style={[S.muted, { color: C.danger, fontWeight: "700" }]} accessibilityLiveRegion="polite">🎙️ {t("app_voiceListening")}</Text>}
        {!!voiceNote && <Text style={[S.muted, { color: C.warn }]}>{voiceNote}</Text>}
        <View style={[S.row, { gap: 8 }]}>
          <Pressable onPress={toggleListening} disabled={busy} accessibilityRole="button" accessibilityLabel={t(listening ? "app_voiceListening" : "app_voiceStart")}
            style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: listening ? C.danger : C.chip, opacity: busy ? 0.5 : 1 }}>
            <Text style={{ fontSize: 22 }}>{listening ? "⏹" : "🎙️"}</Text>
          </Pressable>
          <Pressable onPress={toggleTalk} disabled={busy && !talk} accessibilityRole="switch" accessibilityState={{ checked: talk }} accessibilityLabel={t("app_talkMode")}
            style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: talk ? C.brandDark : C.chip, opacity: busy && !talk ? 0.5 : 1 }}>
            <Text style={{ fontSize: 20 }}>🎧</Text>
          </Pressable>
          <TextInput style={[S.input, { flex: 1, maxHeight: 120 }]} value={text} onChangeText={setText} placeholder={t("aiPlaceholder")} multiline maxLength={1000} />
          <Pressable style={[S.btn, { backgroundColor: C.brandDark }, busy && { opacity: 0.5 }]} onPress={() => send()} disabled={busy} accessibilityRole="button"><Text style={S.btnText}>{t("aiSend")}</Text></Pressable>
        </View>
        <View style={[S.row, { justifyContent: "space-between" }]}>
          <Text style={[S.muted, { flex: 1 }]}>{t("aiDisclaimer")}</Text>
          {messages.length > 0 && (
            <Pressable onPress={newChat} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: C.brandDark, fontWeight: "600" }}>{t("app_newChat")}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
