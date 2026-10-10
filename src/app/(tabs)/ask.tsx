// AI vet & behaviour help. With a dog chosen, its profile goes along so the
// advice fits that dog. Each dog has its own conversation, kept on the phone.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useI18n } from "../../i18n";
import { addChat, ask, clearChat, loadChat, type ChatMessage } from "../../lib/ai";
import { listDogs, type Dog } from "../../lib/dogs";
import { C, S } from "../../ui/theme";

export default function Ask() {
  const { t, lang } = useI18n();
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [dogId, setDogId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);

  useFocusEffect(useCallback(() => {
    listDogs().then((d) => {
      setDogs(d);
      setDogId((cur) => (cur != null && d.some((x) => x.id === cur) ? cur : d.length === 1 ? d[0].id : null));
    }).catch(() => undefined);
  }, []));
  useEffect(() => { loadChat(dogId).then(setMessages).catch(() => setMessages([])); }, [dogId]);

  const send = async () => {
    const content = text.trim().slice(0, 1000);
    if (!content || busy) return;
    const user: ChatMessage = { role: "user", content };
    const history = messages.concat(user);
    setMessages(history); setText(""); setBusy(true);
    await addChat(dogId, user);
    const r = await ask(history, lang, t("emergencyBtn"), dogs.find((d) => d.id === dogId) || null);
    const reply: ChatMessage = "error" in r
      ? { role: "assistant", content: t(r.error === "rate_limited" ? "aiRateLimited" : r.error === "unavailable" ? "aiReply" : "aiError") }
      : { role: "assistant", content: r.reply, urgency: r.urgency, topic: r.topic };
    if (!("error" in r)) await addChat(dogId, reply);
    setMessages((m) => m.concat(reply));
    setBusy(false);
  };

  const cta = (m: ChatMessage) => {
    if (m.urgency === "emergency") return { label: t("aiCtaEmergency"), go: () => router.push("/emergency") };
    if (m.urgency === "vet_soon" || m.urgency === "monitor") {
      return m.topic === "behaviour"
        ? { label: t("aiCtaTrainers"), go: () => router.push({ pathname: "/", params: { cat: "training" } }) }
        : m.urgency === "vet_soon" ? { label: t("aiCtaVets"), go: () => router.push({ pathname: "/", params: { cat: "vet" } }) } : null;
    }
    return null;
  };

  return (
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {dogs.length > 0 && (
        <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, padding: 12, alignItems: "center" }} showsHorizontalScrollIndicator={false}>
          <Text style={S.muted}>{t("app_askFor")}:</Text>
          {[{ id: null as number | null, name: t("app_noDog") }].concat(dogs).map((d) => (
            <Pressable key={String(d.id)} onPress={() => setDogId(d.id)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: dogId === d.id ? C.brand : C.chip }}>
              <Text style={{ color: dogId === d.id ? "#fff" : C.text }}>{d.id != null ? "🐕 " : ""}{d.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m, i) => String(m.id ?? "x" + i)}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={<View style={[S.card, { marginBottom: 8 }]}><Text style={S.body}>{t("aiIntro")}</Text></View>}
        renderItem={({ item: m }) => {
          const action = m.role === "assistant" ? cta(m) : null;
          return (
            <View style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", gap: 6 }}>
              {m.urgency && m.urgency !== "unclear" && (
                <Text style={{ fontWeight: "700", color: m.urgency === "emergency" ? C.danger : m.urgency === "vet_soon" ? C.warn : C.ok }}>
                  {t("urgency_" + m.urgency)}
                </Text>
              )}
              <View style={{ backgroundColor: m.role === "user" ? C.brand : C.card, borderRadius: 14, padding: 10, borderWidth: m.role === "user" ? 0 : 1, borderColor: C.line }}>
                <Text style={[S.body, { color: m.role === "user" ? "#fff" : C.text }]}>{m.content}</Text>
              </View>
              {action && (
                <Pressable style={[S.btn, m.urgency === "emergency" && { backgroundColor: C.danger }]} onPress={action.go}>
                  <Text style={S.btnText}>{action.label}</Text>
                </Pressable>
              )}
            </View>
          );
        }}
        ListFooterComponent={busy ? <ActivityIndicator color={C.brand} style={{ marginTop: 8 }} /> : null}
      />
      <View style={{ padding: 12, gap: 6, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
        <View style={[S.row, { gap: 8 }]}>
          <TextInput style={[S.input, { flex: 1, maxHeight: 120 }]} value={text} onChangeText={setText} placeholder={t("aiPlaceholder")} multiline maxLength={1000} />
          <Pressable style={[S.btn, busy && { opacity: 0.5 }]} onPress={send} disabled={busy} accessibilityRole="button"><Text style={S.btnText}>{t("aiSend")}</Text></Pressable>
        </View>
        <View style={[S.row, { justifyContent: "space-between" }]}>
          <Text style={[S.muted, { flex: 1 }]}>{t("aiDisclaimer")}</Text>
          {messages.length > 0 && (
            <Pressable onPress={async () => { await clearChat(dogId); setMessages([]); }} hitSlop={8}>
              <Text style={{ color: C.brandDark, fontWeight: "600" }}>{t("app_newChat")}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
