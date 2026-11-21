// Find: address or GPS search, categories, independents-only, map or list.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useI18n } from "../../i18n";
import { currentPosition, geocode, LocationDeniedError, reverseLabel, shortLabel, type Spot } from "../../lib/geo";
import { CATEGORIES, CATEGORY_ORDER, NotCoveredError, offline, search, type Place } from "../../lib/places";
import type { Category } from "../../core/classify";
import { PlaceCard } from "../../ui/PlaceCard";
import { PlaceMap } from "../../ui/PlaceMap";
import { Input } from "../../ui/Input";
import { Toggle } from "../../ui/Toggle";
import { useTheme } from "../../ui/theme";

const RADII = [1000, 3000, 5000, 10000, 25000, 50000, 75000, 100000];
const allCats = (on: boolean) => Object.fromEntries(CATEGORY_ORDER.map((c) => [c, on])) as Record<Category, boolean>;

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
  const [cats, setCats] = useState<Record<Category, boolean>>(() => allCats(true));

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

  const filtered = useMemo(() => places.filter((p) => cats[p.cat]), [places, cats]);
  const all = CATEGORY_ORDER.every((c) => cats[c]);
  const independents = filtered.filter((p) => !p.chain);
  const chains = filtered.filter((p) => p.chain);
  const showChains = chains.length > 0 && (!independentOnly || independents.length === 0);
  const shown = showChains ? independents.concat(chains) : independents;

  // "Search further: 25 km" when only chains (or nothing) are near.
  const nextRadius = RADII.find((r) => r > radius);
  const widen = () => { if (nextRadius) { setRadius(nextRadius); if (spot) load(spot, nextRadius); } };
  const WidenButton = () => nextRadius ? (
    <Pressable style={[S.btnGhost, { alignSelf: "flex-start", marginBottom: 8 }]} onPress={widen} accessibilityRole="button">
      <Text style={S.btnGhostText}>🔍 {tf("widenSearch", { km: nextRadius / 1000 })}</Text>
    </Pressable>
  ) : null;

  type Row = { kind: "place"; p: Place } | { kind: "note"; text: string } | { kind: "divider" } | { kind: "widen" };
  const rows: Row[] = independents.map((p) => ({ kind: "place" as const, p }));
  if (showChains) {
    if (independents.length) rows.push({ kind: "divider" });
    else {
      // Only chains nearby: say so, offer a wider search, and show them below.
      rows.push({ kind: "note", text: t("chainOnlyNote") });
      if (independentOnly && nextRadius) rows.push({ kind: "widen" });
    }
    chains.forEach((p) => rows.push({ kind: "place", p }));
  }

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
        <View style={[S.row, { justifyContent: "space-between" }]}>
          <Text style={S.h1}>🐾 Snuffel</Text>
          <Pressable onPress={() => router.push("/settings")} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("app_settings")}>
            <Text style={{ fontSize: 22 }}>⚙️</Text>
          </Pressable>
        </View>
        <View style={[S.row, { gap: 8 }]}>
          <Input
            style={[S.input, { flex: 1 }]} value={query} onChangeText={setQuery}
            placeholder={t("searchPlaceholder")} returnKeyType="search" onSubmitEditing={byAddress} autoCorrect={false}
          />
          <Pressable style={S.btn} onPress={byAddress} accessibilityRole="button"><Text style={S.btnText}>{t("search")}</Text></Pressable>
        </View>
        <Pressable style={S.btnGhost} onPress={nearMe} accessibilityRole="button"><Text style={S.btnGhostText}>📍 {t("useLocation")}</Text></Pressable>
        {/* "All" plus the categories. With everything shown, tapping a category shows
            only that one; after that, taps add or remove. None left, or "All": everything. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Pressable onPress={() => setCats(allCats(true))} accessibilityRole="button" accessibilityState={{ selected: all }}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: all ? C.brandDark : C.chip, borderWidth: 1, borderColor: all ? C.brandDark : C.line }}>
            <Text style={{ color: all ? C.onBrand : C.text, fontWeight: "600" }}>{t("filterAll")}</Text>
          </Pressable>
          {CATEGORY_ORDER.map((c) => {
            const on = !all && cats[c];
            return (
              <Pressable key={c} onPress={() => setCats((s) => {
                if (CATEGORY_ORDER.every((k) => s[k])) return { ...allCats(false), [c]: true };
                const next = { ...s, [c]: !s[c] };
                return CATEGORY_ORDER.some((k) => next[k]) ? next : allCats(true);
              })} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: on ? C.cat[c] + "22" : C.chip, borderWidth: 1, borderColor: on ? C.cat[c] : C.line }}>
                <Text style={{ color: C.text }}>{CATEGORIES[c].icon} {t(CATEGORIES[c].key)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={[S.row, { justifyContent: "space-between" }]}>
          <View style={[S.row, { gap: 6 }]}>
            <Toggle value={independentOnly} onValueChange={setIndependentOnly} />
            <Text style={S.body}>{t("independentOnly")}</Text>
          </View>
          <View style={[S.row, { gap: 6 }]}>
            {(["list", "map"] as const).map((v) => (
              <Pressable key={v} onPress={() => setView(v)} style={[S.btnGhost, { paddingVertical: 6, backgroundColor: view === v ? C.brand : C.chip }]}>
                <Text style={[S.btnGhostText, { color: view === v ? C.onBrand : C.text }]}>{t(v === "list" ? "viewList" : "viewMap")}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
          <Text style={S.muted}>{t("radius")}:</Text>
          {RADII.map((r) => (
            <Pressable key={r} onPress={() => { setRadius(r); if (spot) load(spot, r); }}
              style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: radius === r ? C.strong : C.chip }}>
              <Text style={{ color: radius === r ? C.onStrong : C.text }}>{r / 1000} km</Text>
            </Pressable>
          ))}
        </ScrollView>
        {spot && !busy && !error && (
          <Text style={S.muted} numberOfLines={1}>
            {tf("countResults", { n: shown.length })}{spot.label ? " · " + shortLabel(spot.label) : ""}
          </Text>
        )}
        {offline && !busy && <Text style={[S.muted, { color: C.warn }]}>{t("app_offline")}</Text>}
        {!!error && <Text style={[S.body, { color: C.danger }]}>{error}</Text>}
      </View>

      <View style={{ flex: 1, marginTop: 8 }}>
        {busy ? (
          <View style={{ flex: 1, alignItems: "center", paddingTop: 40, gap: 10 }}>
            <ActivityIndicator size="large" color={C.brand} />
            <Text style={S.muted}>{t("loading")}</Text>
          </View>
        ) : view === "map" ? (
          <PlaceMap places={shown} center={spot} />
        ) : !spot ? (
          <ScrollView contentContainerStyle={S.pad}>
            <Text style={S.h2}>{t("heroTitle")}</Text>
            <Text style={[S.body, { marginTop: 6 }]}>{t("heroSub")}</Text>
            <Text style={[S.muted, { marginTop: 10 }]}>{t("countryNote")}</Text>
          </ScrollView>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r, i) => (r.kind === "place" ? r.p.id : r.kind + i)}
            contentContainerStyle={{ padding: 16, paddingTop: 4 }}
            ListEmptyComponent={<View style={{ gap: 8 }}><Text style={S.muted}>🐶 {t("noResults")} {t("noResultsHint")}</Text><WidenButton /></View>}
            renderItem={({ item }) =>
              item.kind === "place" ? <PlaceCard p={item.p} /> :
              item.kind === "widen" ? <WidenButton /> :
              item.kind === "divider" ? <Text style={[S.h2, { marginVertical: 8 }]}>{t("chainsHeading")}</Text> :
              <Text style={[S.muted, { marginVertical: 8 }]}>{item.text}</Text>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
