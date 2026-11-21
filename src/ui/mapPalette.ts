// Map colours that are not theme tokens. Plain data (no React Native), so
// tests/contrast.test.ts checks them against Protomaps' map colours.

// Every marker (and the dot on Find's category chips, the map's legend) has a white
// ring inside a dark one, in light and dark alike. On the dark map the white ring is
// the marker's edge (16:1 or more); on the light map the dark ring is (10:1 or more).
// With only the white ring, light-mode markers were hard to see on light land: shop
// amber 1.6:1, play green 2.5:1, shelter cyan 2.8:1.
export const MARKER_RING = { inner: "#ffffff", outer: "#0f172a" };

// More label colours for the dark map, next to DARK_MAP_LABELS (palette.ts); both go
// into Protomaps' dark flavour in src/lib/mapStyle.ts. Protomaps draws river, lake and
// sea names at 2.7:1 on the water, region names at 1.5:1 and country names at 2.5:1.
// These are 4.5:1 or more on what lies under them, and stay below the city names
// (#b3b3b3), so the map keeps its order: cities, countries, regions.
export const DARK_MAP_LABELS_MORE = {
  ocean_label: "#9aa3b5",     // rivers, lakes and seas (on `water`), the same blue-grey, lighter
  country_label: "#999999",   // countries (on `earth`)
  state_label: "#8c8c8c"      // regions and provinces (on `state_label_halo`)
};

// The light map's own labels for rivers, lakes and seas, countries and regions were
// as faint: 2.4, 1.9 and 1.6:1 on what lies under them. These are 4.5:1 or more and
// stay a little lighter than the city names (#5c5c5c), so cities still come first.
export const LIGHT_MAP_LABELS = {
  ocean_label: "#28509a",     // on `water`
  country_label: "#5e5e5e",   // on `earth`
  state_label: "#616161"      // on `state_label_halo`
};
