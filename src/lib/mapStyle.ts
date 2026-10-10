// Basemap: the same self-hosted Protomaps file as the website (Europe, z14),
// read directly by MapLibre Native through a pmtiles:// URL (range requests,
// no tile server). Labels follow the app language.
import { layers, namedFlavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { CONFIG } from "./config";

const cache = new Map<string, StyleSpecification>();

export function mapStyle(lang: string): StyleSpecification {
  let style = cache.get(lang);
  if (!style) {
    style = {
      version: 8,
      glyphs: CONFIG.glyphs,
      sprite: CONFIG.sprite,
      sources: {
        protomaps: {
          type: "vector",
          url: "pmtiles://" + CONFIG.pmtiles,
          attribution: "© OpenStreetMap contributors, Protomaps"
        }
      },
      layers: layers("protomaps", namedFlavor("light"), { lang }) as StyleSpecification["layers"]
    };
    cache.set(lang, style);
  }
  return style;
}
