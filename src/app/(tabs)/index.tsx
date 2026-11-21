// Find: address or GPS search, categories, open now, independents only, radius, map or list.
// Four rows of controls under the title, every control 44 px or more: the search
// field with "Near me" inside it (the keyboard's search key searches an address),
// the category chips (their dots are the map's markers: the chips are its legend),
// the two filter switches (Open now, Independents only: what is shown), and the
// radius (one button, the choices in a sheet) with List/Map (where and how). In the
// list, the chips and both rows scroll away with the results; on the map they stay
// above it.
//
// Open now (src/lib/findlist.ts) hides only places known to be closed: places with
// unknown hours stay, below the open ones. It starts off on every launch: it depends
// on the hour, and a filter left on at night would quietly empty the list.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActivityIndicator, FlatList, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../i18n";
import { findList } from "../../lib/findlist";
import { currentPosition, geocode, LocationDeniedError, reverseLabel, shortLabel, type Spot } from "../../lib/geo";
import { CATEGORIES, CATEGORY_ORDER, hoursNow, NotCoveredError, offline, search, type Place } from "../../lib/places";
import type { Category } from "../../core/classify";
import { Icon, Symbol } from "../../ui/Icon";
import { PlaceCard, useMinuteClock } from "../../ui/PlaceCard";
import { MarkerDot, PlaceMap } from "../../ui/PlaceMap";
import { Input } from "../../ui/Input";
import { useTheme } from "../../ui/theme";

const RADII = [1000, 3000, 5000, 10000, 25000, 50000, 75000, 100000];
const km = (r: number) => `${r / 1000} km`;
const allCats = (on: boolean) => Object.fromEntries(CATEGORY_ORDER.map((c) => [c, on])) as Record<Category, boolean>;

// The radius as one button ("3 km ▾"); the choices open in a sheet from the bottom.
function RadiusButton({ value, onChange }: { value: number; onChange: (r: number) => void }) {
  const { t } = useI18n();
  const { C, S } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const pick = (r: number) => { close(); if (r !== value) onChange(r); };
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${t("radius")}: ${km(value)}`}
        style={({ pressed }) => [styles.filter, { gap: 4, paddingLeft: 12, paddingRight: 8, borderColor: C.line, backgroundColor: C.card }, pressed && S.pressed]}>
        <Text style={[styles.filterText, { color: C.text }]}>{km(value)}</Text>
        <Icon name="chevron-down" size={16} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
        {/* The dimmed backdrop is black in light and dark alike (as the date sheet's) */}
        <Pressable style={{ flex: 1, backgroundColor: "#0006" }} onPress={close} accessibilityRole="button" accessibilityLabel={t("close")} />
        <View style={{ backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 6, paddingBottom: insets.bottom + 8 }}>
          <Text style={[S.h2, { paddingHorizontal: 16, paddingVertical: 12 }]} accessibilityRole="header">{t("radius")}</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t("radius")}>
            {RADII.map((r) => {
              const on = r === value;
              return (
                <Pressable key={r} onPress={() => pick(r)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  style={({ pressed }) => [S.row, { minHeight: 48, paddingHorizontal: 16, justifyContent: "space-between",
                    borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: pressed ? C.chip : C.card }]}>
                  <Text style={[S.body, on && { fontWeight: "700" }]}>{km(r)}</Text>
                  {on && <Icon name="check" size={20} color={C.link} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

// A filter switch (Open now, Independents only). On: a ticked box, a green border
// and green text; off: an empty box. The box says it, not the colour alone.
function FilterSwitch({ label, hint, on, onPress }: { label: string; hint?: string; on: boolean; onPress: () => void }) {
  const { C, S } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} accessibilityHint={hint}
      style={({ pressed }) => [styles.filter, { gap: 6, paddingHorizontal: 10, borderWidth: 1.5, borderColor: on ? C.ok : C.line, backgroundColor: C.card }, pressed && S.pressed]}>
      <Icon name={on ? "check-square" : "square"} size={16} color={on ? C.ok : C.muted} />
      <Text style={[styles.filterText, { color: on ? C.ok : C.text, flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
}

// A list heading for Open now: "● Open now", "○ Opening hours unknown" (the dots as on the cards).
function StateHeading({ open, text }: { open: boolean; text: string }) {
  const { C } = useTheme();
  const color = open ? C.ok : C.muted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: open ? 2 : 6, marginBottom: 8 }} accessibilityRole="header">
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: open ? color : "transparent", borderWidth: open ? 0 : 1.5, borderColor: color }}
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <Text style={{ color, fontWeight: "700", fontSize: 14, flexShrink: 1 }}>{text}</Text>
    </View>
  );
}

export default function Find() {
  const { t, tf, lang } = useI18n();
  const { C, S } = useTheme();
  const [query, setQuery] = useState("");
  const [spot, setSpot] = useState<Spot | null>(null);
  const [radius, setRadius] = useState(3000);
  const [places, setPlaces] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [independentOnly, setIndependentOnly] = useState(true);
  const [openOnly, setOpenOnly] = useState(false);
  const [cats, setCats] = useState<Record<Category, boolean>>(() => allCats(true));
  // The cards' open lines and Open now read the same minute, so a card never says
  // "Closed" under "Open now"; a place that closes leaves the list at that minute.
  const now = useMinuteClock();

  const load = useCallback(async (s: Spot, r: number) => {
    setBusy(true); setError(null);
    try { setPlaces(await search(s.lat, s.lon, r)); }
    catch (e) { setPlaces([]); setError(e instanceof NotCoveredError ? t("app_noCoverage") : t("app_errLoad")); }
    finally { setBusy(false); }
  }, [t]);

  const byAddress = async () => {
    Keyboard.dismiss();
    if (!query.trim()) { setError(t("errAddress")); return; }
    setBusy(true); setError(null);
    try {
      const hit = await geocode(query.trim(), lang);
      if (!hit) { setBusy(false); setError(t("errGeocode")); return; }
      setSpot(hit);
      await load(hit, radius);
    } catch { setBusy(false); setError(t("app_errLoad")); }
  };

  const nearMe = async () => {
    Keyboard.dismiss();
    setBusy(true); setError(null);
    try {
      const pos = await currentPosition();
      const s = { ...pos, label: "" };
      setSpot(s);
      await load(s, radius);
      reverseLabel(pos.lat, pos.lon, lang).then((label) => setSpot((cur) => (cur && cur.lat === pos.lat ? { ...cur, label } : cur)));
    } catch (e) {
      setBusy(false);
      setError(e instanceof LocationDeniedError ? t("errGeoDenied") : t("errGeoUnavailable"));
    }
  };

  // From the AI chat: "show vets / trainers near me" opens this tab with ?cat=.
  // Links may also ask for a search near the phone (?near=1) and the map (?view=map).
  const params = useLocalSearchParams<{ cat?: string; near?: string; view?: string }>();
  useEffect(() => {
    const c = params.cat as Category | undefined;
    if (params.view === "map" || params.view === "list") setView(params.view);
    if (c && CATEGORIES[c]) {
      setCats(Object.fromEntries(CATEGORY_ORDER.map((x) => [x, x === c || (c === "vet" && x === "hospital")])) as Record<Category, boolean>);
      nearMe();
    } else if (params.near === "1") nearMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.cat, params.near, params.view]);

  // What the list shows (src/lib/findlist.ts). With Open now, read again every minute.
  const nextRadius = RADII.find((r) => r > radius);
  const clock = openOnly ? now : null;
  const list = useMemo(() => findList(places, {
    cats, independentOnly, openOnly, canWiden: !!nextRadius,
    status: (p) => hoursNow(p, clock ?? undefined)
  }), [places, cats, independentOnly, openOnly, clock, nextRadius]);
  // The map fits its view to `shown` whenever it changes, so typing in the search field
  // or the minute ticking must not hand it a new list: a new one only when its places change.
  const shownKey = list.shown.map((p) => p.id).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => list.shown, [places, shownKey]);
  const all = CATEGORY_ORDER.every((c) => cats[c]);

  const count = spot && !busy && !error
    ? (openOnly && list.unknown ? tf("app_openCounts", { open: list.open, unknown: list.unknown }) : tf("countResults", { n: shown.length }))
      + (spot.label ? " · " + shortLabel(spot.label) : "")
    : null;
  // A filter switched: screen readers hear what the list now holds (after the switch's own state).
  const countRef = useRef(count);
  countRef.current = count;
  const filterState = `${openOnly}|${independentOnly}`;
  const lastFilters = useRef(filterState);
  useEffect(() => {
    if (lastFilters.current === filterState) return;
    lastFilters.current = filterState;
    const timer = setTimeout(() => { if (countRef.current) AccessibilityInfo.announceForAccessibility(countRef.current); }, 600);
    return () => clearTimeout(timer);
  }, [filterState]);

  const pickRadius = (r: number) => { setRadius(r); if (spot) load(spot, r); };
  // "All" plus the categories. With everything shown, tapping a category shows
  // only that one; after that, taps add or remove. None left, or "All": everything.
  const toggleCat = (c: Category) => setCats((s) => {
    if (CATEGORY_ORDER.every((k) => s[k])) return { ...allCats(false), [c]: true };
    const next = { ...s, [c]: !s[c] };
    return CATEGORY_ORDER.some((k) => next[k]) ? next : allCats(true);
  });

  // "Search further: 25 km" when only chains (or nothing, or nothing open) are near.
  const widen = nextRadius ? (
    <Pressable style={({ pressed }) => [S.btnGhost, S.row, { alignSelf: "flex-start", gap: 8, minHeight: 44, marginBottom: 8 }, pressed && S.pressed]}
      onPress={() => pickRadius(nextRadius)} accessibilityRole="button">
      <Icon name="search" size={18} />
      <Text style={S.btnGhostText}>{tf("widenSearch", { km: nextRadius / 1000 })}</Text>
    </Pressable>
  ) : null;

  // The rows that aren't places: headings, notes and the ways on.
  const NOTES = { chainOnly: "chainOnlyNote", openChains: "app_openChainsNote", noneOpen: "app_noneOpen" } as const;
  const ghost = (icon: ReactNode, label: string, onPress: () => void, color?: string) => (
    <Pressable style={({ pressed }) => [S.btnGhost, S.row, { alignSelf: "flex-start", gap: 8, minHeight: 44, marginBottom: 8 }, pressed && S.pressed]}
      onPress={onPress} accessibilityRole="button">
      {icon}
      <Text style={[S.btnGhostText, color ? { color, fontWeight: "700" } : null, { flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
  const renderRow = ({ item }: { item: (typeof list.rows)[number] }) => {
    switch (item.kind) {
      case "place": return <PlaceCard p={item.p} now={now} />;
      case "widen": return widen;
      case "heading":
        if (item.text === "chains") return <Text style={[S.h2, { marginVertical: 8 }]} accessibilityRole="header">{t("chainsHeading")}</Text>;
        return <StateHeading open={item.text === "openNow"} text={t(item.text)} />;
      case "note":
        if (item.text === "noneOpen") {
          return (
            <View style={[S.row, { gap: 8, alignItems: "flex-start", marginTop: 4, marginBottom: 10 }]}>
              <Icon name="clock" size={20} color={C.muted} style={{ marginTop: 1 }} />
              <Text style={[S.body, { flex: 1 }]}>{tf(NOTES.noneOpen, { km: radius / 1000 })}</Text>
            </View>
          );
        }
        return <Text style={[S.muted, { marginVertical: 8 }]}>{t(NOTES[item.text])}</Text>;
      case "showClosed":
        return ghost(<Icon name="eye" size={18} />, tf("app_showClosed", { n: item.n }), () => setOpenOnly(false));
      case "emergency":
        return ghost(<Symbol name="alarm-light-outline" size={19} color={C.danger} />, t("app_findOpenVet"), () => router.navigate("/emergency"), C.danger);
    }
  };

  // The chips, the filter rows and the result line: in the list they scroll with the results.
  const filters = (
    <View style={{ gap: 8, paddingBottom: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
        <Pressable onPress={() => setCats(allCats(true))} accessibilityRole="button" accessibilityState={{ selected: all }}
          style={({ pressed }) => [styles.chip, { paddingHorizontal: 16, backgroundColor: all ? C.brandDark : C.card, borderColor: all ? C.brandDark : C.line }, pressed && S.pressed]}>
          <Text style={[styles.chipText, { color: all ? C.onBrand : C.text, fontWeight: "600" }]}>{t("filterAll")}</Text>
        </Pressable>
        {CATEGORY_ORDER.map((c) => {
          const on = !all && cats[c];
          // Chosen: the category's tint, bold text in its deep shade and a check (not colour alone)
          return (
            <Pressable key={c} onPress={() => toggleCat(c)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.chip, { backgroundColor: on ? C.catDisc[c] : C.card, borderColor: on ? C.cat[c] : C.line }, pressed && S.pressed]}>
              <MarkerDot cat={c} />
              <Text style={[styles.chipText, { color: on ? C.catInk[c] : C.text, fontWeight: on ? "700" : "400" }]}>{t(CATEGORIES[c].key)}</Text>
              {on && <Icon name="check" size={16} color={C.catInk[c]} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* What is shown: the two filter switches, on a row of their own (with the radius and
          List/Map they don't fit 390 px, not even in English). They wrap only at large text sizes. */}
      <View style={[S.row, { flexWrap: "wrap", gap: 8 }]}>
        <FilterSwitch label={t("openNow")} hint={t("app_openNowHint")} on={openOnly} onPress={() => setOpenOnly((v) => !v)} />
        <FilterSwitch label={t("independentOnly")} on={independentOnly} onPress={() => setIndependentOnly((v) => !v)} />
      </View>

      {/* Where and how: the radius, and List or Map */}
      <View style={[S.row, { flexWrap: "wrap", gap: 8 }]}>
        <RadiusButton value={radius} onChange={pickRadius} />
        {/* List or map: a segmented control. marginLeft auto: on the right, also when it wraps to a line of its own. */}
        <View accessibilityRole="radiogroup" style={[S.row, { marginLeft: "auto", padding: 2, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.chip }]}>
          {(["list", "map"] as const).map((v) => {
            const on = view === v;
            return (
              <Pressable key={v} onPress={() => setView(v)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={({ pressed }) => [styles.segment, { backgroundColor: on ? C.strong : "transparent" }, pressed && S.pressed]}>
                <Text style={[styles.filterText, { color: on ? C.onStrong : C.text, fontWeight: on ? "700" : "500" }]}>{t(v === "list" ? "viewList" : "viewMap")}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {!!count && <Text style={S.muted} numberOfLines={2}>{count}</Text>}
      {offline && !busy && <Text style={[S.muted, { color: C.warn }]}>{t("app_offline")}</Text>}
      {!!error && <Text style={[S.body, { color: C.danger }]} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 8 }}>
        <View style={[S.row, { justifyContent: "space-between", minHeight: 44 }]}>
          <View style={[S.row, { gap: 8 }]} accessible accessibilityRole="header" accessibilityLabel="Snuffel">
            <Symbol name="paw" size={24} color={C.link} />
            <Text style={S.h1}>Snuffel</Text>
          </View>
          <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel={t("app_settings")}
            style={({ pressed }) => [styles.iconButton, { marginRight: -10 }, pressed && S.pressed]}>
            <Icon name="settings" size={24} color={C.muted} />
          </Pressable>
        </View>
        {/* The search field, with "Near me" inside it */}
        <View style={[S.row, { minHeight: 52, gap: 8, paddingLeft: 12, paddingRight: 4, borderRadius: 12, borderWidth: 1, borderColor: C.fieldLine, backgroundColor: C.card }]}>
          <Icon name="search" size={20} color={C.muted} />
          <Input
            style={{ flex: 1, minHeight: 44, paddingVertical: 0, paddingHorizontal: 0, fontSize: 16, color: C.text }}
            value={query} onChangeText={setQuery} placeholder={t("app_searchWhere")} accessibilityLabel={t("app_searchWhere")}
            returnKeyType="search" onSubmitEditing={byAddress} autoCorrect={false} clearButtonMode="while-editing"
          />
          <Pressable onPress={nearMe} accessibilityRole="button"
            style={({ pressed }) => [S.row, { minHeight: 44, gap: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.chip }, pressed && S.pressed]}>
            <Icon name="crosshair" size={18} color={C.link} />
            <Text style={[styles.filterText, { color: C.link }]} numberOfLines={1}>{t("app_nearMe")}</Text>
          </Pressable>
        </View>
      </View>

      {view === "list" && spot && !busy ? (
        <FlatList
          data={list.rows}
          extraData={now}
          keyExtractor={(r, i) => (r.kind === "place" ? r.p.id : r.kind + i)}
          ListHeaderComponent={filters}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={error ? undefined : <View style={{ gap: 8 }}><Text style={S.muted}>{t("noResults")} {t("noResultsHint")}</Text>{widen}</View>}
          renderItem={renderRow}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16 }}>{filters}</View>
          {busy ? (
            <View style={{ flex: 1, alignItems: "center", paddingTop: 40, gap: 10 }}>
              <ActivityIndicator size="large" color={C.brand} />
              <Text style={S.muted}>{t("loading")}</Text>
            </View>
          ) : view === "map" ? (
            <View style={{ flex: 1 }}><PlaceMap places={shown} center={spot} /></View>
          ) : (
            <ScrollView contentContainerStyle={[S.pad, { paddingTop: 8 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              <Text style={S.h2}>{t("heroTitle")}</Text>
              <Text style={[S.body, { marginTop: 6 }]}>{t("heroSub")}</Text>
              <Text style={[S.muted, { marginTop: 10 }]}>{t("countryNote")}</Text>
            </ScrollView>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  chipText: { fontSize: 15 },
  filter: { minHeight: 44, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  filterText: { fontSize: 14, fontWeight: "700" },
  segment: { minHeight: 40, minWidth: 52, paddingHorizontal: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }
});
