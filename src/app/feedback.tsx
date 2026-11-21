// After a thumbs down: "May we use this conversation to improve Snuffel?" The screen
// says why, where it is kept, for how long and how to have it removed, and shows
// exactly what would be sent (the report object itself, see src/lib/feedbackReport.ts).
// Nothing leaves the phone unless the owner taps Send.
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useI18n } from "../i18n";
import { feedbackDraft, reportInput, sendReport } from "../lib/feedback";
import { buildReport, LIMITS, type Report } from "../lib/feedbackReport";
import { Input } from "../ui/Input";
import { CopyCode } from "../ui/Rating";
import { useTheme } from "../ui/theme";

const PRIVACY_MAIL = "privacy@snuffel.app";

// The placeholders that replace a name, e-mail address or number (feedbackReport.ts) look
// like what they are: grey labels, not a glitch in the text.
const TOKEN = /(\[name\]|\[email\]|\[number\])/;
function Masked({ text }: { text: string }) {
  const { C, S } = useTheme();
  return (
    <Text style={S.body} selectable>
      {text.split(TOKEN).map((part, i) => TOKEN.test(part)
        ? <Text key={i} style={{ backgroundColor: C.line, color: C.muted, fontWeight: "600" }}>{" " + part + " "}</Text>
        : part)}
    </Text>
  );
}

function Preview({ report }: { report: Report }) {
  const { t, tf } = useI18n();
  const { C, S } = useTheme();
  const d = report.dog;
  const urgency = (u?: string) => (u && u !== "unclear" ? t(u === "vet_today" ? "app_urgency_vet_today" : "urgency_" + u) : "");
  return (
    <View style={[S.card, { gap: 10, backgroundColor: C.chip }]}>
      {d && (
        <View style={{ gap: 2 }}>
          <Text style={[S.body, { fontWeight: "700" }]}>🐕</Text>
          {d.breed != null && <Text style={S.body}>{t("app_breed")}: {d.breed}</Text>}
          {d.ageMonths != null && <Text style={S.body}>{t("app_fbAge")}: {tf("app_ageMonths", { n: d.ageMonths })}</Text>}
          {d.weightKg != null && <Text style={S.body}>{t("app_weight")}: {d.weightKg}</Text>}
          {d.sex != null && <Text style={S.body}>{t("app_sex")}: {t(d.sex === "male" ? "app_male" : "app_female")}</Text>}
          {d.neutered != null && <Text style={S.body}>{t("app_neutered")}: {d.neutered ? "✓" : "✗"}</Text>}
        </View>
      )}
      {report.messages.map((m, i) => (
        <View key={i} style={{ gap: 2 }}>
          <Text style={[S.muted, { fontWeight: "700", color: m.role === "user" ? C.link : C.text }]}>
            {m.role === "user" ? t("app_fbYou") : "Snuffel"}{urgency(m.urgency) ? " · " + urgency(m.urgency) : ""}
          </Text>
          <Masked text={m.content} />
        </View>
      ))}
      <Text style={S.muted}>{t("app_language")}: {report.lang} · {tf("app_version", { v: report.appVersion })}</Text>
    </View>
  );
}

export default function Feedback() {
  const { t, lang } = useI18n();
  const { C, S } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const chatId = Number(id);
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof feedbackDraft>> | undefined>(undefined);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!Number.isInteger(chatId)) { setDraft(null); return; }
    feedbackDraft(chatId).then(setDraft).catch(() => setDraft(null));
  }, [chatId]);
  const report = useMemo(() => (draft ? buildReport(reportInput(draft, comment, lang)) : null), [draft, comment, lang]);

  const send = async () => {
    if (!report || busy) return;
    setBusy(true); setProblem(null);
    const r = await sendReport(chatId, report);
    setBusy(false);
    if ("code" in r) setCode(r.code);
    else setProblem(t(r.error === "rate_limited" ? "app_fbTooMany" : "app_fbFailed"));
  };

  if (draft === undefined) return <View style={[S.screen, { justifyContent: "center" }]}><ActivityIndicator color={C.brand} /></View>;

  // Sent: the removal code, to copy and to mail when the owner wants it removed.
  if (code) {
    return (
      <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={[S.card, { gap: 12 }]}>
          <Text style={[S.h2, { color: C.ok }]}>✓ {t("app_fbSent")}</Text>
          <Text style={S.muted}>{t("app_fbCode")}</Text>
          <CopyCode code={code} big />
          <Text style={S.body}>{t("app_fbRemoveHow")}</Text>
          <Pressable onPress={() => Linking.openURL(`mailto:${PRIVACY_MAIL}?subject=${encodeURIComponent("Snuffel " + code)}`).catch(() => undefined)} accessibilityRole="link">
            <Text style={{ color: C.link, fontWeight: "600" }}>✉️ {PRIVACY_MAIL}</Text>
          </Pressable>
          <Text style={S.muted}>{t("app_fbFindCode")}</Text>
        </View>
        <Pressable style={S.btn} onPress={() => router.back()} accessibilityRole="button"><Text style={S.btnText}>{t("app_done")}</Text></Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={S.h1}>{t("app_fbAsk")}</Text>
        <View style={[S.card, { gap: 8 }]}>
          <Text style={S.body}>🎯 {t("app_fbWhy")}</Text>
          <Text style={S.body}>🇪🇺 {t("app_fbWhere")}</Text>
          <Text style={S.body}>🗓️ {t("app_fbHowLong")}</Text>
          <Text style={S.body}>🗑️ {t("app_fbRemoveInfo")}</Text>
        </View>
        {!report ? <Text style={[S.body, { color: C.warn }]}>{t("app_fbFailed")}</Text> : (
          <>
            <Text style={S.h2}>{t("app_fbWhatSent")}</Text>
            {/* Before the conversation: otherwise "[name]" in the text looks like a bug */}
            <Text style={S.muted}>🔒 {t("app_fbNotSent")}</Text>
            <Preview report={report} />
            <Input style={S.input} value={comment} onChangeText={setComment} placeholder={t("app_fbComment")}
              maxLength={LIMITS.comment} returnKeyType="done" accessibilityLabel={t("app_fbComment")} />
            {/* The note as it is sent, when replacing a name or number changed it */}
            {!!report.comment && report.comment !== comment.replace(/\s+/g, " ").trim() && <Text style={S.muted}>→ {report.comment}</Text>}
          </>
        )}
        {!!problem && <Text style={[S.body, { color: C.warn }]} accessibilityLiveRegion="polite">{problem}</Text>}
        <View style={{ gap: 8 }}>
          {!!report && (
            <Pressable style={[S.btn, busy && { opacity: 0.6 }]} onPress={send} disabled={busy} accessibilityRole="button">
              {busy ? <ActivityIndicator color={C.onBrand} /> : <Text style={S.btnText}>{t("app_fbSend")}</Text>}
            </Pressable>
          )}
          <Pressable style={S.btnGhost} onPress={() => router.back()} disabled={busy} accessibilityRole="button">
            <Text style={S.btnGhostText}>{t("app_fbDontSend")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
