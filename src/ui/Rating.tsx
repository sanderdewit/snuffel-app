// Thumbs up/down under an AI answer, the removal code once a conversation was
// sent, and the list of sent conversations in Settings. A thumbs up stays on the
// phone; a thumbs down opens the consent screen (src/app/feedback.tsx), which is
// the only place anything is sent from.
import { useCallback, useState } from "react";
// React Native's own Clipboard: deprecated but still in RN 0.88, and it needs no
// extra native module (switch to expo-clipboard when RN removes it).
import { Clipboard, Platform, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useI18n } from "../i18n";
import { formatDate, isoDate } from "../lib/dates";
import { getRating, sentReports, setVote, type Rating as RatingRow } from "../lib/feedback";
import { C, S } from "./theme";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

/** The removal code, selectable, with a Copy button. */
export function CopyCode({ code, big }: { code: string; big?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <View style={[S.row, { gap: 12, flexWrap: "wrap" }]}>
      <Text selectable style={{ fontFamily: MONO, fontSize: big ? 22 : 14, fontWeight: "700", color: C.text, letterSpacing: 1 }}>{code}</Text>
      <Pressable onPress={() => { Clipboard.setString(code); setCopied(true); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("app_fbCopy")}>
        <Text style={{ color: C.brandDark, fontWeight: "600" }}>{copied ? "✓ " + t("app_fbCopied") : "📋 " + t("app_fbCopy")}</Text>
      </Pressable>
    </View>
  );
}

export function Rating({ id }: { id: number }) {
  const { t } = useI18n();
  const [r, setR] = useState<RatingRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(() => { getRating(id).then((x) => { setR(x); setLoaded(true); }).catch(() => setLoaded(true)); }, [id]);
  useFocusEffect(load);   // back from the consent screen: show the code
  if (!loaded) return null;
  if (r?.code) {
    return (
      <View style={{ gap: 2 }}>
        <Text style={[S.muted, { color: C.ok, fontWeight: "600" }]}>✓ {t("app_fbSentShort")}</Text>
        <CopyCode code={r.code} />
      </View>
    );
  }
  const up = async () => { await setVote(id, r?.vote === "up" ? null : "up").catch(() => undefined); load(); };
  const down = async () => {
    await setVote(id, "down").catch(() => undefined);
    load();
    router.push({ pathname: "/feedback", params: { id: String(id) } });
  };
  const thumb = (vote: "up" | "down", label: string, onPress: () => void) => {
    const on = r?.vote === vote;
    return (
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}
        style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: on ? C.brandDark : "transparent", backgroundColor: on ? C.chip : "transparent" }}>
        <Text style={{ fontSize: 16, opacity: on ? 1 : 0.6 }}>{vote === "up" ? "👍" : "👎"}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[S.row, { gap: 6 }]}>
      {thumb("up", t("app_fbUp"), up)}
      {thumb("down", t("app_fbDown"), down)}
    </View>
  );
}

/** Settings → Privacy: what was sent from this phone, with the codes to have it removed. */
export function SentReports() {
  const { t, lang } = useI18n();
  const [list, setList] = useState<RatingRow[]>([]);
  useFocusEffect(useCallback(() => { sentReports().then(setList).catch(() => undefined); }, []));
  if (!list.length) return null;
  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      <Text style={[S.body, { fontWeight: "700" }]}>👎 {t("app_fbSentList")}</Text>
      {list.map((x) => (
        <View key={x.chatId} style={{ gap: 2 }}>
          <Text style={S.muted} numberOfLines={1}>{formatDate(isoDate(new Date(x.at)), lang)}{x.title ? " · " + x.title : ""}</Text>
          <CopyCode code={x.code!} />
        </View>
      ))}
      <Text style={S.muted}>{t("app_fbRemoveHow")}</Text>
    </View>
  );
}
