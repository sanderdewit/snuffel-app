// A place in a list (Find, Saved, Emergency), and the pieces the place screen and
// Emergency share with it: the open-now line, the chain badge, the Call button.
import { useEffect, useState } from "react";
import { AppState, Linking, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { useI18n } from "../i18n";
import { dayNames, statusText, type Status } from "../lib/hourstext";
import { callUrl, directionsUrl } from "../lib/placelinks";
import { CATEGORIES, hoursNow, type Place } from "../lib/places";
import { remember } from "../lib/placeStore";
import { CategoryIcon } from "./Emoji";
import { Icon, Symbol } from "./Icon";
import { useTheme, type Palette } from "./theme";

// Kept here too: other screens import them from the card.
export { callUrl, directionsUrl };

export function displayName(p: Place, t: (k: string) => string) {
  // Unnamed places are nearly always dog areas; others fall back to their category.
  return p.name || t(p.cat === "play" ? "app_unnamedPlay" : CATEGORIES[p.cat].key);
}

const isVet = (p: Place) => p.cat === "vet" || p.cat === "hospital";

/** The time, renewed every minute (and on return to the app): "closes at 12:00" must not go stale on screen. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { timer = setTimeout(() => { setNow(new Date()); schedule(); }, 60000 - (Date.now() % 60000) + 50); };
    schedule();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") setNow(new Date()); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);
  return now;
}

/** The colour of an open state: green while open (amber in its last hour), grey when closed or unknown. */
export function statusColor(s: Status, C: Palette): string {
  if (s.kind === "always") return C.ok;
  if (s.kind === "open") return s.soon ? C.warn : C.ok;
  return C.muted;
}

/**
 * "Open now · closes at 18:00", "Closed · opens Tuesday at 09:00", "Open 24/7",
 * "Opening hours unknown" (for vets only: in Emergency no line would read as open),
 * or the clinic's own 24/7 emergency service. Read fresh, on the place's clock.
 */
export function OpenLine({ p, now, size = 14 }: { p: Place; now?: Date; size?: number }) {
  const { t, tf, lang } = useI18n();
  const { C } = useTheme();
  if (p.emergency === "24/7" && !p.is247) {
    return (
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }]}>
        <Symbol name="ambulance" size={size + 3} color={C.ok} />
        <Text style={{ color: C.ok, fontWeight: "700", fontSize: size, flexShrink: 1 }}>{t("emergency247")}</Text>
      </View>
    );
  }
  const s = hoursNow(p, now);
  if (s.kind === "unknown" && !isVet(p)) return null;
  const color = statusColor(s, C);
  const open = s.kind === "open" || s.kind === "always";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: open ? color : "transparent", borderWidth: open ? 0 : 1.5, borderColor: color }}
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <Text style={{ color, fontWeight: open ? "700" : "600", fontSize: size, flexShrink: 1 }}>{statusText(s, tf, dayNames(lang))}</Text>
    </View>
  );
}

export function ChainBadge({ p }: { p: Place }) {
  const { t, tf } = useI18n();
  const { C } = useTheme();
  if (p.chain) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon name="alert-triangle" size={14} color={C.warn} />
        <Text style={{ color: C.warn, fontWeight: "600" }}>{tf("chainBadge", { name: p.chain })}</Text>
      </View>
    );
  }
  if (p.cat === "play" || p.cat === "shelter") return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name="check" size={14} color={C.ok} />
      <Text style={{ color: C.ok, fontWeight: "600" }}>{t("independent")}</Text>
    </View>
  );
}

/** The number to call: the practice, else its own emergency line. */
export const phoneOf = (p: Place) => p.phone || p.emergencyPhone || null;

/** Call, red in Emergency. Without a number it says so instead of leaving a gap. */
export function CallButton({ phone, name, danger, style }: { phone: string | null; name: string; danger?: boolean; style?: StyleProp<ViewStyle> }) {
  const { t, tf } = useI18n();
  const { C, S } = useTheme();
  if (!phone) {
    return (
      <View style={[{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: C.line, borderStyle: "dashed", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 }, style]}>
        <Icon name="phone-off" size={16} color={C.muted} />
        <Text style={[S.muted, { flexShrink: 1 }]}>{t("app_noPhone")}</Text>
      </View>
    );
  }
  return (
    <Pressable onPress={() => Linking.openURL(callUrl(phone))} accessibilityRole="button" accessibilityLabel={tf("app_callMyVet", { name })}
      style={({ pressed }) => [S.btn, { minHeight: 48, flexDirection: "row", gap: 8 }, danger && { backgroundColor: C.dangerFill }, style, pressed && S.pressed]}>
      <Icon name="phone" size={18} color={C.onBrand} />
      <Text style={S.btnText}>{t("call")}</Text>
    </Pressable>
  );
}

export function DirectionsButton({ p, style }: { p: Place; style?: StyleProp<ViewStyle> }) {
  const { t } = useI18n();
  const { C, S } = useTheme();
  return (
    <Pressable onPress={() => Linking.openURL(directionsUrl(p))} accessibilityRole="button" accessibilityLabel={t("directions") + ", " + displayName(p, t)}
      style={({ pressed }) => [S.btnGhost, { minHeight: 48, flexDirection: "row", gap: 8 }, style, pressed && S.pressed]}>
      <Icon name="navigation" size={17} color={C.text} />
      <Text style={S.btnGhostText}>{t("directions")}</Text>
    </Pressable>
  );
}

/** "Out of hours: emergency line via the practice", with its own number to call when there is one. */
export function OnCallLine({ p, callable }: { p: Place; callable?: boolean }) {
  const { t, tf } = useI18n();
  const { C, S } = useTheme();
  if (p.emergency !== "on_call") return null;
  const number = p.emergencyPhone && p.emergencyPhone !== p.phone ? p.emergencyPhone : null;
  const text = (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
      <Icon name="phone-call" size={14} color={C.muted} style={{ marginTop: 2 }} />
      <Text style={[S.muted, { flexShrink: 1 }]}>
        {t("emergencyOnCall")}
        {p.emergencyPhone ? ": " : ""}
        {p.emergencyPhone ? <Text style={callable && number ? { color: C.link, fontWeight: "600", textDecorationLine: "underline" } : undefined}>{p.emergencyPhone}</Text> : null}
      </Text>
    </View>
  );
  if (!callable || !number) return text;
  return (
    <Pressable onPress={() => Linking.openURL(callUrl(number))} accessibilityRole="link" accessibilityLabel={t("emergencyOnCall") + ": " + number}
      hitSlop={{ top: 8, bottom: 8 }} style={({ pressed }) => [{ minHeight: 44, justifyContent: "center" }, pressed && S.pressed]}>
      {text}
    </Pressable>
  );
}

/**
 * A place in a list. `big`: Call and Directions on the card. `emergency`: as on the
 * Emergency tab: Call in red, no chain or independent badge (distance wins there),
 * the out-of-hours number callable. `now` re-renders the open line every minute.
 */
export function PlaceCard({ p, big, emergency, now }: { p: Place; big?: boolean; emergency?: boolean; now?: Date }) {
  const { t, tf } = useI18n();
  const { S } = useTheme();
  const cat = CATEGORIES[p.cat];
  const actions = big || emergency;
  const open = () => { remember(p); router.push({ pathname: "/place/[id]", params: { id: p.id, lat: String(p.lat), lon: String(p.lon) } }); };
  return (
    <View style={[S.card, { marginBottom: 10, padding: 0 }]}>
      {/* The details are one button; Call and Directions sit beside it, not inside it, so screen readers reach them. */}
      <Pressable onPress={open} accessibilityRole="button" style={({ pressed }) => [{ padding: 14, paddingBottom: actions ? 8 : 14 }, pressed && S.pressed]}>
        <View style={[S.row, { gap: 10, alignItems: "flex-start" }]}>
          {!emergency && <CategoryIcon cat={p.cat} size={19} box={38} always />}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[S.h2, actions && { fontSize: 18 }]} numberOfLines={2}>{displayName(p, t)}</Text>
            <Text style={S.muted} numberOfLines={1}>
              {t(cat.key)}{Number.isFinite(p.dist) ? " · " + tf("distanceAway", { km: p.dist < 10 ? p.dist.toFixed(1) : Math.round(p.dist) }) : ""}
            </Text>
            {!!p.address && <Text style={S.muted} numberOfLines={1}>{p.address}</Text>}
            <View style={[S.row, { gap: 12, flexWrap: "wrap", marginTop: 2 }]}>
              <OpenLine p={p} now={now} size={actions ? 15 : 14} />
              {!emergency && <ChainBadge p={p} />}
            </View>
            {!actions && <OnCallLine p={p} />}
          </View>
        </View>
      </Pressable>
      {actions && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
          <OnCallLine p={p} callable />
          <View style={[S.row, { gap: 8 }]}>
            <CallButton phone={phoneOf(p)} name={displayName(p, t)} danger={emergency} style={{ flex: 1 }} />
            <DirectionsButton p={p} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </View>
  );
}
