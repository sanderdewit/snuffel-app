// Basemap: the same self-hosted Protomaps file as the website (Europe, z14),
// read directly by MapLibre Native through a pmtiles:// URL (range requests,
// no tile server). Labels follow the app language; the colours follow light or
// dark (Protomaps' own "light" and "dark" flavours, with their matching sprites:
// only the style changes, the tiles are the same).
import { layers, namedFlavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { CONFIG } from "./config";

const cache = new Map<string, StyleSpecification>();

export function mapStyle(lang: string, scheme: "light" | "dark" = "light"): StyleSpecification {
  const key = `${lang}:${scheme}`;
  let style = cache.get(key);
  if (!style) {
    style = {
      version: 8,
      glyphs: CONFIG.glyphs,
      sprite: CONFIG.sprites + scheme,
      sources: {
        protomaps: {
          type: "vector",
          url: "pmtiles://" + CONFIG.pmtiles,
          attribution: "© OpenStreetMap contributors, Protomaps"
        }
      },
      layers: layers("protomaps", namedFlavor(scheme), { lang }) as StyleSpecification["layers"]
    };
    cache.set(key, style);
  }
  return style;
}
