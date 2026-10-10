// Map of places on the self-hosted basemap. Markers are one GeoJSON source with
// a circle layer coloured per category (fast with hundreds of places).
import { useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import { Camera, GeoJSONSource, Layer, Map, NativeUserLocation, type CameraRef } from "@maplibre/maplibre-react-native";
import { useI18n } from "../i18n";
import { mapStyle } from "../lib/mapStyle";
import { CATEGORIES, type Place } from "../lib/places";
import { recall, remember } from "../lib/placeStore";

export function PlaceMap({ places, center, showUser }: { places: Place[]; center: { lat: number; lon: number } | null; showUser?: boolean }) {
  const { lang } = useI18n();
  const camera = useRef<CameraRef>(null);
  const style = useMemo(() => mapStyle(lang), [lang]);

  const data = useMemo<GeoJSON.FeatureCollection>(() => {
    places.forEach(remember);
    return {
      type: "FeatureCollection",
      features: places.map((p) => ({
        type: "Feature",
        id: p.id,
        properties: { id: p.id, color: CATEGORIES[p.cat].color, chain: p.chain ? 1 : 0 },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] }
      }))
    };
  }, [places]);

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

  return (
    <Map style={StyleSheet.absoluteFill} mapStyle={style} logo={false} attribution compass={false}>
      <Camera ref={camera} initialViewState={{ center: center ? [center.lon, center.lat] : [10, 50], zoom: center ? 12 : 3.5 }} />
      {showUser && <NativeUserLocation />}
      <GeoJSONSource
        id="places"
        data={data}
        onPress={(ev) => {
          const id = ev.nativeEvent.features[0]?.properties?.id as string | undefined;
          const p = id ? recall(id) : null;
          if (p) router.push({ pathname: "/place/[id]", params: { id: p.id, lat: String(p.lat), lon: String(p.lon) } });
        }}
      >
        <Layer
          type="circle"
          id="places-circle"
          paint={{
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 14, 8],
            "circle-color": ["get", "color"],
            "circle-opacity": ["case", ["==", ["get", "chain"], 1], 0.45, 1],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2
          }}
        />
      </GeoJSONSource>
    </Map>
  );
}
