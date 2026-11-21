// Emergency: opening the tab (or the home-screen shortcut) is the search: GPS, then
// vets and animal hospitals that are open now, nearest first; closed ones are hidden
// and the search widens until there are options. Results come first: one status
// line, two small links (swallowed something, dog lost or found), My vet as one row
// with its open state and Call, then the cards. Search again from the header.
//
// Every card's open line is read fresh, on the place's clock, every minute; the
// search itself runs again when the tab or the app comes back after a while (a vet
// that has opened since must not be missing).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, Linking, Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import { router, Tabs, useFocusEffect } from "expo-router";
import { useI18n } from "../../i18n";
import { currentPosition, reverseLabel, shortLabel } from "../../lib/geo";
import { emergency, emergencyRank, hoursNow, NotCoveredError, offline, type Place } from "../../lib/places";
import { remember } from "../../lib/placeStore";
import { myVet, type SavedPlace } from "../../lib/saved";
import { Icon, type IconName } from "../../ui/Icon";
import { CallButton, displayName, OnCallLine, OpenLine, PlaceCard, phoneOf, useMinuteClock } from "../../ui/PlaceCard";
import { useTheme } from "../../ui/theme";

const STALE_MS = 2 * 60 * 1000;
// "🔎 Dog lost or found?" without its emoji: the link has its own icon.
const withoutEmoji = (s: string) => s.replace(/^[\uD800-\uDBFF][\uDC00-\uDFFF]️?\s*/, "");
// reverseLabel() falls back to coordinates; those say nothing to a person.
const placeLabel = (label: string) => (/^-?\d+\.\d+, -?\d+\.\d+$/.test(label) ? null : shortLabel(label) || null);

type Problem = { text: string; location: boolean };

export default function Emergency() {
  const { t, tf, lang } = useI18n();
  const { C, S } = useTheme();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [radiusM, setRadiusM] = useState(0);
  const [phase, setPhase] = useState<"idle" | "locating" | "searching">("idle");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [near, setNear] = useState<string | null>(null);
  const [vet, setVet] = useState<SavedPlace | null>(null);
  const now = useMinuteClock();
  const busy = phase !== "idle";

  const runId = useRef(0);          // only the latest search may set the list
  const lastRun = useRef(0);
  const focused = useRef(false);
  const problemRef = useRef<Problem | null>(null);
  problemRef.current = problem;

  const run = useCallback(async () => {
    const id = ++runId.current;
    lastRun.current = Date.now();
    setPhase("locating"); setProblem(null);
    let located = false;
    try {
      const pos = await currentPosition();
      if (id !== runId.current) return;
      located = true;
      setPhase("searching");
      // Where the search is from, so a wrong position shows ("near ..."); never waited for.
      setNear(null);
      reverseLabel(pos.lat, pos.lon, lang).then((label) => { if (id === runId.current) setNear(placeLabel(label)); }).catch(() => undefined);
      const r = await emergency(pos.lat, pos.lon);
      if (id !== runId.current) return;
      setPlaces(r.places); setRadiusM(r.radiusM);
    } catch (e) {
      if (id !== runId.current) return;
      // No position (not allowed, location off, or no fix in time): say so, with ways around it.
      const noLocation = !located;
      setProblem({
        text: noLocation ? t("app_locationNeeded") : e instanceof NotCoveredError ? t("app_noCoverage") : t("app_errLoad"),
        location: noLocation
      });
    } finally {
      if (id === runId.current) setPhase("idle");
    }
  }, [t, lang]);

  // Opening the tab is the "one tap". Coming back from a place's details within a
  // couple of minutes keeps the list instead of searching again.
  useFocusEffect(useCallback(() => {
    focused.current = true;
    myVet().then(setVet).catch(() => undefined);
    if (Date.now() - lastRun.current > STALE_MS) run();
    return () => { focused.current = false; };
  }, [run]));

  // Back in the app (after a call, the map, or Settings): search again when the list is
  // stale, or when location was the problem and is now allowed and on. That is checked
  // without asking: the permission prompt itself also sends the app away and back.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active" || !focused.current || runId.current < 1) return;
      myVet().then(setVet).catch(() => undefined);
      if (problemRef.current?.location) {
        Promise.all([Location.getForegroundPermissionsAsync(), Location.hasServicesEnabledAsync()])
          .then(([perm, on]) => { if (perm.status === "granted" && on && problemRef.current?.location) run(); })
          .catch(() => undefined);
      } else if (Date.now() - lastRun.current > STALE_MS) run();
    });
    return () => sub.remove();
  }, [run]);

  // Search again: an icon button in the header.
  const options = useMemo(() => ({
    headerRight: () => (
      <Pressable onPress={run} disabled={busy} accessibilityRole="button" accessibilityLabel={t("app_searchAgain")} accessibilityState={{ busy, disabled: busy }}
        style={({ pressed }) => [{ width: 44, height: 44, marginRight: 4, alignItems: "center", justifyContent: "center" }, pressed && S.pressed]}>
        {busy ? <ActivityIndicator color={C.danger} /> : <Icon name="rotate-cw" size={22} color={C.danger} />}
      </Pressable>
    )
  }), [run, busy, t, C, S]);

  const anyOpen = !!places && places.some((p) => emergencyRank(p) === 0);
  const openVet = () => {
    if (!vet) return;
    remember(vet);
    router.push({ pathname: "/place/[id]", params: { id: vet.id, lat: String(vet.lat), lon: String(vet.lon) } });
  };

  // The one status line (on the alert surface), and a second, smaller one when needed.
  let icon: IconName = "map-pin", line = "", second: string | null = null;
  if (problem) { icon = "alert-triangle"; line = problem.text; }
  else if (!places) { line = phase === "searching" ? t("loading") : t("locating"); }
  else if (!places.length) { icon = "alert-triangle"; line = t("noResults"); }
  else if (!anyOpen) { icon = "alert-triangle"; line = t("emergencyNone"); }
  else line = near ? tf("app_emergencyNear", { place: near }) : t("app_emergencyNearYou");
  if (!problem && places && radiusM > 10000) second = tf("emergencyRadiusNote", { km: Math.round(radiusM / 1000) });
  if (!problem && places && offline) second = (second ? second + " " : "") + t("app_offline");

  const vetName = vet ? displayName(vet, t) : "";
  const vetPhone = vet ? phoneOf(vet) : null;
  const vetOpen = vet ? (() => { const s = hoursNow(vet, now); return s.kind === "open" || s.kind === "always" || vet.emergency === "24/7"; })() : false;

  const header = (
    <View style={{ gap: 10, marginBottom: 10 }}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={[S.card, { backgroundColor: C.alertBg, borderColor: C.alertLine, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", gap: 10, alignItems: "flex-start" }]}>
        {!places && !problem
          ? <ActivityIndicator color={C.alertText} style={{ marginTop: 1 }} />
          : <Icon name={icon} size={20} color={C.alertText} style={{ marginTop: 1 }} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.alertText, fontSize: 15, lineHeight: 21, fontWeight: anyOpen && !problem ? "400" : "600" }}>{line}</Text>
          {!!second && <Text style={{ color: C.alertText, fontSize: 13, lineHeight: 18 }}>{second}</Text>}
        </View>
      </View>

      {/* Only when the search couldn't run: the full-size way to try again, and ways around it. */}
      {!!problem && !busy && (
        <View style={{ gap: 8 }}>
          <Pressable onPress={run} accessibilityRole="button"
            style={({ pressed }) => [S.btn, { backgroundColor: C.dangerFill, minHeight: 48, flexDirection: "row", gap: 8 }, pressed && S.pressed]}>
            <Icon name="crosshair" size={18} color={C.onBrand} />
            <Text style={S.btnText}>{t("app_findOpenVet")}</Text>
          </Pressable>
          {problem.location && (
            <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
              <SmallLink icon="settings" label={t("app_openSettings")} onPress={() => Linking.openSettings().catch(() => undefined)} />
              <SmallLink icon="edit-3" label={t("app_typeAddress")} onPress={() => router.navigate({ pathname: "/", params: { cat: "vet" } })} />
            </View>
          )}
        </View>
      )}

      <View style={[S.row, { gap: 8, flexWrap: "wrap" }]}>
        <SmallLink icon="message-circle" label={t("app_swallowed")}
          onPress={() => router.navigate({ pathname: "/ask", params: { q: t("app_aiStarter3") } })} />
        <SmallLink icon="search" label={withoutEmoji(t("lostOpen"))} onPress={() => router.push("/lost")} />
      </View>

      {vet && (
        <View style={[S.card, { padding: 0, flexDirection: "row", alignItems: "center" }]}>
          <Pressable onPress={openVet} accessibilityRole="button"
            style={({ pressed }) => [{ flex: 1, minWidth: 0, paddingVertical: 10, paddingLeft: 14, paddingRight: 8, gap: 2 }, pressed && S.pressed]}>
            <View style={[S.row, { gap: 5 }]}>
              <Icon name="home" size={14} color={C.muted} />
              <Text style={[S.muted, { fontWeight: "600" }]}>{t("app_myVet")}</Text>
            </View>
            <Text style={S.h2} numberOfLines={2}>{vetName}</Text>
            <OpenLine p={vet} now={now} />
            {!vetOpen && <OnCallLine p={vet} />}
          </Pressable>
          {!!vetPhone && (
            <View style={{ paddingRight: 10 }}>
              <CallButton phone={vetPhone} name={vetName} danger style={{ minWidth: 88, paddingHorizontal: 12 }} />
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={S.screen}>
      <Tabs.Screen options={options} />
      <FlatList
        data={places || []}
        extraData={now}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => {
          // Open first, then unknown hours (often simply closed: evenings, weekends),
          // then closed clinics whose phone line reaches the on-call vet.
          const rank = emergencyRank(item);
          const first = index === 0 || emergencyRank(places![index - 1]) < rank;
          return (
            <>
              {first && rank === 0 && (
                <View style={[S.row, { gap: 6, marginTop: 2, marginBottom: 8 }]} accessibilityRole="header">
                  <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.ok }} />
                  <Text style={{ color: C.ok, fontWeight: "700", fontSize: 14 }}>{t("openNow")}</Text>
                </View>
              )}
              {first && rank > 0 && (
                <Text style={[S.muted, { fontWeight: "700", fontSize: 14, marginTop: 6, marginBottom: 8 }]} accessibilityRole="header">
                  {t(rank === 1 ? "emergencyUnknownHeading" : "emergencyOnCallHeading")}
                </Text>
              )}
              <PlaceCard p={item} emergency now={now} />
            </>
          );
        }}
        ListFooterComponent={places && places.length ? <Text style={[S.muted, { textAlign: "center" }]}>{t("app_callFirst")}</Text> : undefined}
      />
    </View>
  );
}

/** A small link-like button with an icon (44 pt high). */
function SmallLink({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { C, S } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }, pressed && S.pressed]}>
      <Icon name={icon} size={18} color={C.link} />
      <Text style={{ color: C.text, fontSize: 14, fontWeight: "600", flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}
