// The AI's triage level, shown so it can't be missed: each answer with a level starts
// with a band in the level's colour, with its own icon (an octagon for urgent, a clock
// for today, a calendar for soon, an eye for "keep an eye on it"), the level's text and
// "AI first assessment, not a diagnosis". The level never rests on colour alone: in
// dark mode "Urgent" and "See a vet today" are both light warm tints, so urgent is the
// only filled band (white on dangerFill, 4.8:1); the others sit on the chip surface with
// a bar and text in the level's colour (C.urgency passes on chip in both schemes).
import { Text, View } from "react-native";
import { useI18n } from "../i18n";
import { Icon, type IconName } from "./Icon";
import type { UrgencyLevel } from "./palette";
import { useTheme } from "./theme";

export const LEVEL_ICON: Record<UrgencyLevel, IconName> = {
  emergency: "alert-octagon", vet_today: "clock", vet_soon: "calendar", monitor: "eye"
};

/** A triage level that gets a band ("unclear" and none get the plain line instead). */
export const isLevel = (u: string | undefined | null): u is UrgencyLevel =>
  u === "emergency" || u === "vet_today" || u === "vet_soon" || u === "monitor";

/** The level's existing text: "Urgent — see a vet now", "See a vet today", … */
export const levelKey = (level: UrgencyLevel) => (level === "vet_today" ? "app_urgency_vet_today" : "urgency_" + level);

// An emoji outside the BMP (a surrogate pair: U+1F000 and up), or a symbol from
// U+2190 to U+2BFF (arrows, ⏹, ☎, ⚠, ✓, …). Built from code points, no `u` flag needed.
const ch = (n: number) => String.fromCharCode(n);
const LEADING_EMOJI = new RegExp(`^(?:[${ch(0xd83c)}-${ch(0xd83e)}][${ch(0xdc00)}-${ch(0xdfff)}]|[${ch(0x2190)}-${ch(0x2bff)}])`);

/**
 * A shared text that starts with an emoji ("🚨 Find an open vet now", from the website's
 * packs) without it, for use next to an Icon. Only a leading emoji (and the space after
 * it) goes; any other text is returned as it is.
 */
export function withoutEmoji(s: string): string {
  return LEADING_EMOJI.test(s) ? s.replace(/^\S+\s+/, "") : s;
}

/** The band at the top of an answer. A header for screen readers: level and note in one. */
export function UrgencyBand({ level }: { level: UrgencyLevel }) {
  const { t } = useI18n();
  const { C } = useTheme();
  const filled = level === "emergency";
  const ink = filled ? C.onBrand : C.urgency[level];
  const title = t(levelKey(level)), note = t("app_aiFirstAssessment");
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`${title}. ${note}`}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, paddingRight: 14,
        paddingLeft: filled ? 14 : 10, borderLeftWidth: filled ? 0 : 4, borderLeftColor: C.urgency[level],
        backgroundColor: filled ? C.dangerFill : C.chip }}>
      <Icon name={LEVEL_ICON[level]} size={filled ? 26 : 24} color={ink} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: "700", color: ink }}>{title}</Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: filled ? C.onBrand : C.text }}>{note}</Text>
      </View>
    </View>
  );
}

/** An answer without a level still says what it is: a quiet line at its top. */
export function AssessmentNote() {
  const { t } = useI18n();
  const { C, S } = useTheme();
  return (
    <View style={[S.row, { gap: 6, paddingHorizontal: 14, paddingTop: 10 }]}>
      <Icon name="info" size={14} color={C.muted} />
      <Text style={[S.muted, { flex: 1 }]}>{t("app_aiFirstAssessment")}</Text>
    </View>
  );
}

/** The level as one line, icon and text in its colour (the note after a voice call). */
export function UrgencyLabel({ level }: { level: UrgencyLevel }) {
  const { t } = useI18n();
  const { C } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name={LEVEL_ICON[level]} size={18} color={C.urgency[level]} />
      <Text style={{ flexShrink: 1, fontWeight: "700", color: C.urgency[level] }}>{t(levelKey(level))}</Text>
    </View>
  );
}
