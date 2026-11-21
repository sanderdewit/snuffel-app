// Map of places on the self-hosted basemap. Markers are one GeoJSON source with
// circle layers coloured per category (fast with hundreds of places); in dark mode
// the basemap is Protomaps' dark flavour and the markers are lighter tints. The
// marker colours are the dots on Find's category chips, so the chips are the legend.
//
// Every marker has a white ring inside a dark one (mapPalette.ts): the white ring is
// its edge on the dark map, the dark ring on the light map. Chains are drawn faded.
//
// Tapping a marker shows that place's card at the bottom of the map, without leaving
// it; tapping the card opens the place, tapping the map elsewhere or × closes it.
// The tap area is 48 x 48 px (MapLibre's default is 44), and of the markers in it the
// one nearest to the finger is taken.
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Camera, GeoJSONSource, Layer, Map, NativeUserLocation, type CameraRef, type CircleLayerSpecification, type FilterSpecification } from "@maplibre/maplibre-react-native";
import type { Category } from "../core/classify";
import { useI18n } from "../i18n";
import { mapStyle } from "../lib/mapStyle";
import type { Place } from "../lib/places";
import { remember } from "../lib/placeStore";
import { Icon } from "./Icon";
import { MARKER_RING } from "./mapPalette";
import { PlaceCard } from "./PlaceCard";
import { useTheme } from "./theme";

type CirclePaint = NonNullable<CircleLayerSpecification["paint"]>;
// The marker's radius (without its rings) by zoom; `extra` for the chosen one.
const radius = (extra: number): CirclePaint["circle-radius"] =>
  ["interpolate", ["linear"], ["zoom"], 8, 5 + extra, 14, 9 + extra, 17, 11 + extra];
const INNER_RING = 2, OUTER_RING = 1.5, CHOSEN = 3;
const HIT = 24;   // half the tap area, px
const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };

/** A marker as it looks on the map: for the category chips, the map's legend. Decoration only. */
export function MarkerDot({ cat, size = 14 }: { cat: Category; size?: number }) {
  const { C } = useTheme();
  const dot = size - 6;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: OUTER_RING, borderColor: MARKER_RING.outer,
      backgroundColor: MARKER_RING.inner, alignItems: "center", justifyContent: "center" }} {...hidden}>
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: C.cat[cat] }} />
    </View>
  );
}

export function PlaceMap({ places, center, showUser }: { places: Place[]; center: { lat: number; lon: number } | null; showUser?: boolean }) {
  const { lang, t } = useI18n();
  const { scheme, C, S } = useTheme();
  const camera = useRef<CameraRef>(null);
  const style = useMemo(() => mapStyle(lang, scheme), [lang, scheme]);
  const [chosen, setChosen] = useState<Place | null>(null);

  const byId = useMemo(() => new globalThis.Map(places.map((p) => [p.id, p] as const)), [places]);
  const data = useMemo<GeoJSON.FeatureCollection>(() => {
    places.forEach(remember);
    return {
      type: "FeatureCollection",
      features: places.map((p) => ({
        type: "Feature",
        id: p.id,
        properties: { id: p.id, color: C.cat[p.cat], chain: p.chain ? 1 : 0 },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] }
      }))
    };
  }, [places, C]);

  // A new search or another filter: the card goes when its place is no longer shown.
  useEffect(() => { setChosen((c) => (c && byId.has(c.id) ? byId.get(c.id)! : null)); }, [byId]);

  useEffect(() => {
    if (!places.length) {
      if (center) camera.current?.flyTo({ center: [center.lon, center.lat], zoom: 13 });
      return;
    }
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const p of places.slice(0, 40)) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
    if (center) { w = Math.min(w, center.lon); e = Math.max(e, center.lon); s = Math.min(s, center.lat); n = Math.max(n, center.lat); }
    camera.current?.fitBounds([w, s, e, n], { padding: { top: 48, right: 48, bottom: 48, left: 48 }, duration: 600 });
  }, [places, center]);

  const only: FilterSpecification = ["==", ["get", "id"], chosen?.id ?? ""];
  const fill: CirclePaint["circle-color"] = ["get", "color"];

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        style={StyleSheet.absoluteFill} mapStyle={style} logo={false} attribution compass={false}
        // top right: the card at the bottom never covers the OpenStreetMap credit
        attributionPosition={{ top: 8, right: 8 }}
        // a tap on the map itself (not on a marker) closes the card
        onPress={(ev) => { if (!("features" in ev.nativeEvent)) setChosen(null); }}
      >
        <Camera ref={camera} initialViewState={{ center: center ? [center.lon, center.lat] : [10, 50], zoom: center ? 12 : 3.5 }} />
        {showUser && <NativeUserLocation />}
        <GeoJSONSource
          id="places"
          data={data}
          hitbox={{ top: HIT, right: HIT, bottom: HIT, left: HIT }}
          onPress={(ev) => {
            ev.stopPropagation();
            const { features, lngLat } = ev.nativeEvent;
            const k = Math.cos((lngLat[1] * Math.PI) / 180);
            let best: Place | null = null, bestD = Infinity;
            for (const f of features) {
              const p = byId.get(f.properties?.id as string);
              if (!p) continue;
              const d = ((p.lon - lngLat[0]) * k) ** 2 + (p.lat - lngLat[1]) ** 2;
              if (d < bestD) { bestD = d; best = p; }
            }
            if (best) setChosen(best);
          }}
        >
          {/* The dark outer ring: drawn just outside the white one (a stroke lies outside the radius) */}
          <Layer
            type="circle"
            id="places-ring"
            paint={{ "circle-radius": radius(INNER_RING), "circle-opacity": 0, "circle-stroke-color": MARKER_RING.outer, "circle-stroke-width": OUTER_RING }}
          />
          <Layer
            type="circle"
            id="places-circle"
            paint={{
              "circle-radius": radius(0),
              "circle-color": fill,
              "circle-opacity": ["case", ["==", ["get", "chain"], 1], 0.45, 1],
              "circle-stroke-color": MARKER_RING.inner,
              "circle-stroke-width": INNER_RING
            }}
          />
          {/* The chosen marker: larger, on top, never faded */}
          <Layer
            type="circle"
            id="places-chosen-ring"
            filter={only}
            paint={{ "circle-radius": radius(CHOSEN + INNER_RING), "circle-opacity": 0, "circle-stroke-color": MARKER_RING.outer, "circle-stroke-width": OUTER_RING }}
          />
          <Layer
            type="circle"
            id="places-chosen"
            filter={only}
            paint={{ "circle-radius": radius(CHOSEN), "circle-color": fill, "circle-stroke-color": MARKER_RING.inner, "circle-stroke-width": INNER_RING }}
          />
        </GeoJSONSource>
      </Map>

      {chosen && (
        <View style={styles.sheet} pointerEvents="box-none">
          <Pressable onPress={() => setChosen(null)} accessibilityRole="button" accessibilityLabel={t("close")}
            style={({ pressed }) => [styles.close, styles.shadow, { backgroundColor: C.card, borderColor: C.line }, pressed && S.pressed]}>
            <Icon name="x" size={20} />
          </Pressable>
          {/* The card opens the place. It has a 10 px bottom margin for lists: cancelled here,
              so the shadow (on Android: the elevated background) is exactly the card. */}
          <View style={[styles.shadow, { borderRadius: 14, backgroundColor: C.card }]}>
            <View style={{ marginBottom: -10 }}><PlaceCard p={chosen} /></View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: 12, right: 12, bottom: 12, gap: 8 },
  close: { alignSelf: "flex-end", width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  // black in light and dark alike: a shadow is a shadow (it hardly shows on the dark map, the card's lighter surface does)
  shadow: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6 }
});
