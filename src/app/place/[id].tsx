// Place details: is it open and until when, Call / Directions / Website, the week's
// opening hours (with their source and a way to correct them), contact details,
// Save and My vet, Share. Opened from a list (the place is handed over in memory)
// or from a link (looked up again by id).
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../i18n";
import { capitalize, dayNames, placeClock, publicHolidays, rangeText, reopensAfter, reopensText, statusText, weekRows } from "../../lib/hourstext";
import { callUrl, directionsUrl, osmNoteUrl, reviewsUrl, websiteDomain, websiteUrl } from "../../lib/placelinks";
import { CATEGORIES, HOURS, hoursNow, placeById, placeTz, refreshOpenState, type Place } from "../../lib/places";
import { recall } from "../../lib/placeStore";
import { isSaved, save, setMyVet, unsave } from "../../lib/saved";
import { ChainBadge, displayName, OnCallLine, phoneOf, statusColor, useMinuteClock } from "../../ui/PlaceCard";
import { CategoryIcon } from "../../ui/Emoji";
import { Icon, Symbol, type IconName } from "../../ui/Icon";
import { useTheme } from "../../ui/theme";

export default function PlaceScreen() {
  const { t, tf, lang } = useI18n();
  const { C, S } = useTheme();
  const { id, lat, lon } = useLocalSearchParams<{ id: string; lat?: string; lon?: string }>();
  const [p, setP] = useState<Place | null>(() => recall(id));
  // A distance only for a place opened from a list: looked up by link, it is measured from the place itself.
  const [fromList] = useState(() => !!recall(id));
  const [missing, setMissing] = useState(false);
  const [state, setState] = useState({ saved: false, myVet: false });
  const now = useMinuteClock();

  useEffect(() => {
    if (!p && lat && lon) placeById(id, Number(lat), Number(lon)).then((x) => (x ? setP(x) : setMissing(true)));
    else if (!p) setMissing(true);
    isSaved(id).then(setState).catch(() => undefined);
  }, [id, lat, lon, p]);

  const name = p ? displayName(p, t) : "";
  // Share in the header, as an icon button with its name for screen readers.
  const options = useMemo(() => ({
    title: p ? t(CATEGORIES[p.cat].key) : "",
    headerRight: () => (
      <Pressable disabled={!p} accessibilityRole="button" accessibilityLabel={t("app_share")}
        onPress={() => p && Share.share({ message: [displayName(p, t), p.address, directionsUrl(p)].filter(Boolean).join("\n") })}
        style={({ pressed }) => [{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }, pressed && S.pressed]}>
        <Icon name="share" size={21} color={C.link} />
      </Pressable>
    )
  }), [p, t, C, S]);

  if (!p) return <View style={[S.screen, S.pad]}>{missing ? <Text style={S.muted}>{t("noResults")}</Text> : <ActivityIndicator color={C.brand} />}</View>;
  refreshOpenState([p]);   // what Save stores
  const cat = CATEGORIES[p.cat];
  const isVet = p.cat === "vet" || p.cat === "hospital";
  const days = dayNames(lang);
  const tz = placeTz(p);
  const status = hoursNow(p, now);
  const reopens = reopensAfter(HOURS, p.hours, tz, status);
  const phone = phoneOf(p);
  const toggleSave = async () => { if (state.saved) await unsave(p.id); else await save(p); setState(await isSaved(p.id)); };
  const toggleMyVet = async () => { await setMyVet(p, !state.myVet); setState(await isSaved(p.id)); };
  const open = status.kind === "open" || status.kind === "always";
  const color = statusColor(status, C);
  // Unknown hours are said for vets (no line could read as open), not for a park or a shop.
  const showStatus = status.kind !== "unknown" || isVet;
  const emergency247 = p.emergency === "24/7" && !p.is247;

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Stack.Screen options={options} />

      <View style={{ gap: 4 }}>
        <View style={[S.row, { gap: 8 }]}>
          <CategoryIcon cat={p.cat} size={16} box={28} />
          <Text style={[S.muted, { fontSize: 14 }]}>
            {t(cat.key)}{fromList && Number.isFinite(p.dist) ? " · " + tf("distanceAway", { km: p.dist < 10 ? p.dist.toFixed(1) : Math.round(p.dist) }) : ""}
          </Text>
        </View>
        <Text style={S.h1} accessibilityRole="header">{name}</Text>
        {!!p.address && <Text style={S.body} selectable>{p.address}</Text>}
        <View style={[S.row, { gap: 12, flexWrap: "wrap", marginTop: 2 }]}><ChainBadge p={p} /></View>
        {p.chain && p.chainVia && <Text style={S.muted}>({t("via_" + p.chainVia)})</Text>}
      </View>

      {/* Open now, and until when */}
      {(showStatus || emergency247) && (
        <View style={{ gap: 2 }} accessible>
          {showStatus && (
            <View style={[S.row, { gap: 8 }]}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: open ? color : "transparent", borderWidth: open ? 0 : 1.5, borderColor: color }} />
              <Text style={{ fontSize: 17, lineHeight: 24, fontWeight: "700", color, flexShrink: 1 }}>{statusText(status, tf, days)}</Text>
            </View>
          )}
          {!!reopens && <Text style={[S.muted, { fontSize: 14, marginLeft: 18 }]}>{reopensText(reopens, tf, days)}</Text>}
          {/* A clinic's own 24/7 emergency service: also when its regular hours say closed. */}
          {emergency247 && (
            <View style={[S.row, { gap: 6 }]}>
              <Symbol name="ambulance" size={20} color={C.ok} />
              <Text style={{ fontSize: 15, fontWeight: "700", color: C.ok }}>{t("emergency247")}</Text>
            </View>
          )}
        </View>
      )}

      {/* The three things people come here for */}
      <View style={[S.row, { gap: 8, alignItems: "stretch" }]}>
        {!!phone && <Tile icon="phone" label={t("call")} a11y={tf("app_callMyVet", { name })} bg={C.brand} fg={C.onBrand} onPress={() => Linking.openURL(callUrl(phone))} />}
        <Tile icon="navigation" label={t("directions")} bg={C.strong} fg={C.onStrong} onPress={() => Linking.openURL(directionsUrl(p))} />
        {!!p.website && <Tile icon="globe" label={t("website")} bg={C.card} fg={C.text} iconColor={C.link} border={C.line} onPress={() => Linking.openURL(websiteUrl(p.website!))} />}
      </View>

      <HoursCard p={p} now={now} />

      {/* Contact */}
      <View style={[S.card, { padding: 0 }]}>
        {!!p.website && (
          <ContactRow icon="globe" title={websiteDomain(p.website)} titleColor={C.link} sub={t("website")} external onPress={() => Linking.openURL(websiteUrl(p.website!))} />
        )}
        {phone
          ? <ContactRow icon="phone" title={phone} sub={t("app_phone")} a11y={tf("app_callMyVet", { name }) + ", " + phone} onPress={() => Linking.openURL(callUrl(phone))} divider={!!p.website} />
          : <ContactRow icon="phone-off" title={t("app_noPhone")} titleColor={C.muted} divider={!!p.website} />}
        <ContactRow icon="star" title={t("reviews")} sub={t("app_opensMaps")} external onPress={() => Linking.openURL(reviewsUrl(p))} divider />
      </View>

      <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
        <Toggle on={state.saved} onPress={toggleSave} label={t(state.saved ? "app_saved" : "app_save")}
          icon={<Symbol name={state.saved ? "bookmark" : "bookmark-outline"} size={19} color={state.saved ? C.link : C.text} />} />
        {isVet && (
          <Toggle on={state.myVet} onPress={toggleMyVet} label={t(state.myVet ? "app_unsetMyVet" : "app_setMyVet")}
            icon={<Symbol name={state.myVet ? "home" : "home-outline"} size={19} color={state.myVet ? C.link : C.text} />} />
        )}
      </View>
      <Text style={S.muted}>{t("footerProto")}</Text>
    </ScrollView>
  );
}

/** One of the three top actions: an icon over its label, at least 64 pt high. */
function Tile({ icon, label, a11y, bg, fg, iconColor, border, onPress }: { icon: IconName; label: string; a11y?: string; bg: string; fg: string; iconColor?: string; border?: string; onPress: () => void }) {
  const { S } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label}
      style={({ pressed }) => [{ flex: 1, minWidth: 0, minHeight: 64, borderRadius: 12, backgroundColor: bg, alignItems: "center", justifyContent: "center", gap: 4, padding: 6 },
        border ? { borderWidth: 1, borderColor: border } : null, pressed && S.pressed]}>
      <Icon name={icon} size={22} color={iconColor ?? fg} />
      <Text style={{ color: fg, fontSize: 14, fontWeight: "700", textAlign: "center" }} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

function ContactRow({ icon, title, titleColor, sub, a11y, external, divider, onPress }: { icon: IconName; title: string; titleColor?: string; sub?: string; a11y?: string; external?: boolean; divider?: boolean; onPress?: () => void }) {
  const { C, S } = useTheme();
  const body = (
    <>
      <Icon name={icon} size={20} color={C.muted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: titleColor ?? C.text }}>{title}</Text>
        {!!sub && <Text style={S.muted}>{sub}</Text>}
      </View>
      {external && <Icon name="external-link" size={18} color={C.muted} />}
    </>
  );
  const style = [{ minHeight: 56, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingVertical: 8, paddingHorizontal: 14 },
    divider && { borderTopWidth: 1, borderTopColor: C.line }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole={external ? "link" : "button"} accessibilityLabel={a11y ?? (sub ? title + ", " + sub : title)}
      style={({ pressed }) => [...style, pressed && S.pressed]}>
      {body}
    </Pressable>
  );
}

function Toggle({ on, label, icon, onPress }: { on: boolean; label: string; icon: ReactNode; onPress: () => void }) {
  const { C, S } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}
      style={({ pressed }) => [S.btnGhost, { minHeight: 44, flexDirection: "row", gap: 6, borderWidth: 1, borderColor: on ? C.link : C.line }, pressed && S.pressed]}>
      {icon}
      <Text style={S.btnGhostText}>{label}</Text>
    </Pressable>
  );
}

/** The week, Monday first, in the app's language; today marked; honest about what couldn't be read. */
function HoursCard({ p, now }: { p: Place; now: Date }) {
  const { t, tf, lang } = useI18n();
  const { C, S } = useTheme();
  const days = dayNames(lang);
  const w = HOURS.week(p.hours);
  const today = placeClock(now, placeTz(p)).day;
  const rows = weekRows(w, today);
  const ph = rows ? publicHolidays(p.hours) : null;
  const incomplete = !!w && !w.always && !w.complete;
  const raw = (p.hours || "").split(";").map((s) => s.trim()).filter(Boolean).join("\n");

  return (
    <View style={[S.card, { gap: 8 }]}>
      <View style={[S.row, { gap: 8 }]}>
        <Icon name="clock" size={20} color={C.muted} />
        <Text style={S.h2} accessibilityRole="header">{t("app_openingHours")}</Text>
      </View>

      {!p.hours && <Text style={[S.body, { color: C.muted }]}>{t("app_hoursUnknown")}</Text>}
      {!!w && w.always && <Text style={[S.body, { color: C.ok, fontWeight: "700" }]}>{t("open247")}</Text>}
      {/* Rules hours.js couldn't read at all: as written, rather than nothing. */}
      {!!p.hours && !w && <Text style={S.body} selectable>{raw}</Text>}

      {rows && (
        <View>
          {rows.map((r) => {
            const value = r.unknown ? t("app_dayUnknown") : r.closed ? t("closedNow") : r.ranges.join(", ");
            return (
              <View key={r.day} accessible accessibilityLabel={`${capitalize(days[r.day])}${r.today ? ", " + t("app_today") : ""}: ${value}`}
                style={[S.row, { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, alignItems: "flex-start" }, r.today && { backgroundColor: C.chip }]}>
                <Text style={[S.body, { flex: 1, fontWeight: r.today ? "700" : "400" }]}>
                  {capitalize(days[r.day])}
                  {r.today && <Text style={{ fontSize: 13, fontWeight: "600", color: C.ok }}>{"  · " + t("app_today")}</Text>}
                </Text>
                <View style={{ alignItems: "flex-end" }}>
                  {r.ranges.length
                    ? r.ranges.map((x) => <Text key={x} style={[S.body, { fontVariant: ["tabular-nums"], fontWeight: r.today ? "700" : "400" }]}>{x}</Text>)
                    : <Text style={[S.body, { color: C.muted, fontStyle: r.unknown ? "italic" : "normal" }]}>{value}</Text>}
                </View>
              </View>
            );
          })}
          {ph && (
            <View accessible style={[S.row, { paddingVertical: 8, paddingHorizontal: 10, alignItems: "flex-start" }]}>
              <Text style={[S.muted, { flex: 1, fontSize: 14 }]}>{t("app_publicHolidays")}</Text>
              <Text style={[S.muted, { fontSize: 14, textAlign: "right" }]}>{ph.closed ? t("closedNow") : ph.ranges.map(rangeText).join("\n")}</Text>
            </View>
          )}
        </View>
      )}
      {incomplete && (
        <View style={{ gap: 4 }}>
          <Text style={S.muted}>{t("app_hoursIncomplete")}</Text>
          <Text style={[S.muted, { fontVariant: ["tabular-nums"] }]} selectable>{raw}</Text>
        </View>
      )}

      {/* (A clinic's own 24/7 emergency service is in the status above.) */}
      {p.emergency === "on_call" && (
        <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          <OnCallLine p={p} callable />
        </View>
      )}

      <View style={[S.row, { flexWrap: "wrap", columnGap: 6 }]}>
        {!!p.hours && <Text style={S.muted}>{t(p.hoursFromSite ? "app_hoursFromSite" : "app_hoursFromOsm")} ·</Text>}
        <Pressable onPress={() => Linking.openURL(osmNoteUrl(p))} accessibilityRole="link" hitSlop={{ top: 4, bottom: 4 }}
          style={({ pressed }) => [{ minHeight: 44, justifyContent: "center" }, pressed && S.pressed]}>
          <Text style={{ fontSize: 13, color: C.link, fontWeight: "600" }}>{t("app_hoursSuggestFix")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
