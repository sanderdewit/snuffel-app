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
import { Icon } from "./Icon";
import { useTheme } from "./theme";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

/** The removal code, selectable, with a Copy button. */
export function CopyCode({ code, big }: { code: string; big?: boolean }) {
  const { t } = useI18n();
  const { C, S } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <View style={[S.row, { gap: 12, flexWrap: "wrap" }]}>
      <Text selectable style={{ fontFamily: MONO, fontSize: big ? 22 : 14, fontWeight: "700", color: C.text, letterSpacing: 1 }}>{code}</Text>
      <Pressable onPress={() => { Clipboard.setString(code); setCopied(true); }} accessibilityRole="button" accessibilityLabel={t(copied ? "app_fbCopied" : "app_fbCopy")}
        style={({ pressed }) => [S.row, { gap: 6, minHeight: 44, paddingHorizontal: 4 }, pressed && S.pressed]}>
        <Icon name={copied ? "check" : "copy"} size={16} color={copied ? C.ok : C.link} />
        <Text style={{ color: copied ? C.ok : C.link, fontWeight: "600" }}>{t(copied ? "app_fbCopied" : "app_fbCopy")}</Text>
      </Pressable>
    </View>
  );
}

export function Rating({ id }: { id: number }) {
  const { t } = useI18n();
  const { C, S } = useTheme();
  const [r, setR] = useState<RatingRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(() => { getRating(id).then((x) => { setR(x); setLoaded(true); }).catch(() => setLoaded(true)); }, [id]);
  useFocusEffect(load);   // back from the consent screen: show the code
  if (!loaded) return null;
  if (r?.code) {
    return (
      <View style={{ gap: 2, paddingHorizontal: 8 }}>
        <View style={[S.row, { gap: 6 }]}>
          <Icon name="check" size={14} color={C.ok} />
          <Text style={[S.muted, { flexShrink: 1, color: C.ok, fontWeight: "600" }]}>{t("app_fbSentShort")}</Text>
        </View>
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
  // 44 px targets; the chosen one on the chip surface in the link colour (not colour alone: also the disc)
  const thumb = (vote: "up" | "down", label: string, onPress: () => void) => {
    const on = r?.vote === vote;
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}
        style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
          backgroundColor: on ? C.chip : "transparent", borderWidth: on ? 1 : 0, borderColor: C.link }, pressed && S.pressed]}>
        <Icon name={vote === "up" ? "thumbs-up" : "thumbs-down"} size={20} color={on ? C.link : C.muted} />
      </Pressable>
    );
  };
  return (
    <View style={S.row}>
      {thumb("up", t("app_fbUp"), up)}
      {thumb("down", t("app_fbDown"), down)}
    </View>
  );
}

/** Settings → Privacy: what was sent from this phone, with the codes to have it removed. */
export function SentReports() {
  const { t, lang } = useI18n();
  const { C, S } = useTheme();
  const [list, setList] = useState<RatingRow[]>([]);
  useFocusEffect(useCallback(() => { sentReports().then(setList).catch(() => undefined); }, []));
  if (!list.length) return null;
  return (
    <View style={{ gap: 8, marginTop: 4 }}>
      <View style={[S.row, { gap: 8 }]}>
        <Icon name="thumbs-down" size={16} color={C.muted} />
        <Text style={[S.body, { flex: 1, fontWeight: "700" }]}>{t("app_fbSentList")}</Text>
      </View>
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
