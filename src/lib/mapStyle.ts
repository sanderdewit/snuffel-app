// Basemap: the same self-hosted Protomaps file as the website (Europe, z14),
// read directly by MapLibre Native through a pmtiles:// URL (range requests,
// no tile server). Labels follow the app language; the colours follow light or
// dark (Protomaps' own "light" and "dark" flavours, with their matching sprites:
// only the style changes, the tiles are the same). Dark has lighter label
// colours than Protomaps': street names were 2.1:1 (DARK_MAP_LABELS in palette.ts),
// river and lake names 2.7:1, region names 1.5:1 and country names 2.5:1
// (DARK_MAP_LABELS_MORE in mapPalette.ts); all are now 4.5:1 or more.
import { layers, namedFlavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { CONFIG } from "./config";
import { DARK_MAP_LABELS } from "../ui/palette";
import { DARK_MAP_LABELS_MORE, LIGHT_MAP_LABELS } from "../ui/mapPalette";

const flavor = (scheme: "light" | "dark") =>
  scheme === "dark" ? { ...namedFlavor("dark"), ...DARK_MAP_LABELS, ...DARK_MAP_LABELS_MORE } : { ...namedFlavor("light"), ...LIGHT_MAP_LABELS };

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
      layers: layers("protomaps", flavor(scheme), { lang }) as StyleSpecification["layers"]
    };
    cache.set(key, style);
  }
  return style;
}
