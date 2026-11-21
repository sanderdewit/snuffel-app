// Run with:  node tests/contrast.test.ts
// WCAG AA contrast of the main text/background pairs, in the light and the dark
// palette (src/ui/palette.ts): 4.5:1 for text, 3:1 for UI (spinners, borders,
// the switch). Also: the AI's urgency colours stay apart from each other; emoji
// drawn in black stay visible on their discs; the dark map's labels and markers.
import assert from "node:assert";
import { namedFlavor } from "@protomaps/basemaps";
import type { Category } from "../src/core/classify.ts";
import { DARK_MAP_LABELS, PALETTES, type Palette, type Scheme, type UrgencyLevel } from "../src/ui/palette.ts";
import { DARK_MAP_LABELS_MORE, MARKER_RING } from "../src/ui/mapPalette.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}

// WCAG 2.x relative luminance and contrast ratio.
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hue = (hex: string) => {
  const [r, g, b] = rgb(hex), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

type Pick = (C: Palette) => string;
const TEXT = 4.5, UI = 3;
// The dark grey of 🩺's tube, 🎓, 🐾 and 🎧 (Apple and Google; some parts are darker still)
const EMOJI_DARK = "#3d3d3d";
const surfaces: [string, Pick][] = [["bg", (C) => C.bg], ["card", (C) => C.card], ["chip", (C) => C.chip]];
const URGENCY: UrgencyLevel[] = ["emergency", "vet_today", "vet_soon", "monitor"];

// [what, foreground, background, minimum]
const PAIRS: [string, Pick, Pick, number][] = [
  // text tokens on every surface they sit on
  ...(["text", "muted", "link", "danger", "ok", "warn"] as const).flatMap((fg) =>
    surfaces.map(([bgName, bg]) => [`${fg} on ${bgName}`, (C: Palette) => C[fg], bg, TEXT] as [string, Pick, Pick, number])),
  ...URGENCY.flatMap((u) =>
    surfaces.map(([bgName, bg]) => [`urgency ${u} on ${bgName}`, (C: Palette) => C.urgency[u], bg, TEXT] as [string, Pick, Pick, number])),
  ["muted on line ([name] labels)", (C) => C.muted, (C) => C.line, TEXT],
  ["text on noteBg (the app's own chat message)", (C) => C.text, (C) => C.noteBg, TEXT],
  // filled buttons, chips and own messages
  ["onBrand on brand (buttons, chosen chips)", (C) => C.onBrand, (C) => C.brand, TEXT],
  ["onBrand on brandDark (own messages, Send)", (C) => C.onBrand, (C) => C.brandDark, TEXT],
  ["onBrand on dangerFill (call, hang up)", (C) => C.onBrand, (C) => C.dangerFill, TEXT],
  ["onStrong on strong (Directions)", (C) => C.onStrong, (C) => C.strong, TEXT],
  // the emergency banner
  ["alertText on alertBg", (C) => C.alertText, (C) => C.alertBg, TEXT],
  ["danger on alertBg (Emergency ›)", (C) => C.danger, (C) => C.alertBg, TEXT],
  // UI: spinners and the chosen-vet border, buttons against the screen, the switch
  ["brand on bg (spinners)", (C) => C.brand, (C) => C.bg, UI],
  ["brand on card (chosen border)", (C) => C.brand, (C) => C.card, UI],
  ["brandDark on bg (own messages)", (C) => C.brandDark, (C) => C.bg, UI],
  ["toggleOn on card", (C) => C.toggleOn, (C) => C.card, UI],
  ["white knob on toggleOn", () => "#ffffff", (C) => C.toggleOn, UI],
  // the voice screen's level bars: lit (link) against unlit (line); brand there is 2.2:1 in dark
  ["link on line (lit and unlit level bars)", (C) => C.link, (C) => C.line, UI],
  // emoji drawn in black or dark grey (🩺, 🎓, 🐾, 🎧) on their discs: about 1:1 on the dark card itself
  ...(Object.keys(PALETTES.light.cat) as Category[]).map((c) =>
    [`dark emoji on catDisc ${c}`, () => EMOJI_DARK, (C: Palette) => C.catDisc[c], TEXT] as [string, Pick, Pick, number]),
  ["dark emoji on glyphBg (mic, conversation mode, paw)", () => EMOJI_DARK, (C) => C.glyphBg, TEXT],
  ["fieldLine on card (the edge of a text field)", (C) => C.fieldLine, (C) => C.card, UI],
  ["fieldLine on bg", (C) => C.fieldLine, (C) => C.bg, UI],
  // a category's line symbol on its disc (place cards, chips, the place title)
  ...(Object.keys(PALETTES.light.cat) as Category[]).map((c) =>
    [`catInk ${c} on catDisc`, (C: Palette) => C.catInk[c], (C: Palette) => C.catDisc[c], TEXT] as [string, Pick, Pick, number])
];

// Only in dark. Light keeps its look: there the discs are faint tints.
const DARK_PAIRS: [string, Pick, Pick, number][] = [
  ["glyphBg on card (the disc stands out)", (C) => C.glyphBg, (C) => C.card, UI],
  ...(Object.keys(PALETTES.dark.cat) as Category[]).map((c) =>
    [`catDisc ${c} on card`, (C: Palette) => C.catDisc[c], (C: Palette) => C.card, UI] as [string, Pick, Pick, number])
];

const rows: string[] = [];
for (const scheme of ["light", "dark"] as Scheme[]) {
  const C = PALETTES[scheme];
  console.log(scheme);
  test("every colour is a 6-digit hex (the category tints append an alpha)", () => {
    const all = Object.values(C).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v as Record<string, string>)));
    for (const v of all) assert.match(v, /^#[0-9a-f]{6}$/, v);
  });
  for (const [what, fg, bg, min] of scheme === "dark" ? PAIRS.concat(DARK_PAIRS) : PAIRS) {
    const r = contrast(fg(C), bg(C));
    rows.push(`${scheme.padEnd(5)}  ${what.padEnd(46)} ${fg(C)} on ${bg(C)}  ${r.toFixed(2)}`);
    test(`${what}: ${r.toFixed(2)} >= ${min}`, () => assert.ok(r >= min, `${fg(C)} on ${bg(C)} is ${r.toFixed(2)}:1`));
  }
  test("urgency colours are apart (hue at least 10 degrees)", () => {
    for (let i = 0; i < URGENCY.length; i++) for (let j = i + 1; j < URGENCY.length; j++) {
      const a = hue(C.urgency[URGENCY[i]]), b = hue(C.urgency[URGENCY[j]]);
      const d = Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
      assert.ok(d >= 10, `${URGENCY[i]} and ${URGENCY[j]} are ${d.toFixed(0)} degrees apart`);
    }
  });
}

test("light and dark have the same tokens", () => {
  assert.deepStrictEqual(Object.keys(PALETTES.dark).sort(), Object.keys(PALETTES.light).sort());
  assert.deepStrictEqual(Object.keys(PALETTES.dark.urgency).sort(), Object.keys(PALETTES.light.urgency).sort());
  assert.deepStrictEqual(Object.keys(PALETTES.dark.cat).sort(), Object.keys(PALETTES.light.cat).sort());
  assert.deepStrictEqual(Object.keys(PALETTES.dark.catDisc).sort(), Object.keys(PALETTES.light.cat).sort());
  assert.deepStrictEqual(Object.keys(PALETTES.light.catDisc).sort(), Object.keys(PALETTES.light.cat).sort());
});

// Light mode looks as before: the card's disc was the category colour at 0x22 alpha on white.
test("light catDisc is the old tint (cat + 22 on the white card)", () => {
  const L = PALETTES.light;
  for (const c of Object.keys(L.cat) as Category[]) {
    const old = rgb(L.cat[c]).map((v) => Math.round((v * 0x22 / 255 + (1 - 0x22 / 255)) * 255));
    const now = rgb(L.catDisc[c]).map((v) => Math.round(v * 255));
    assert.ok(now.every((v, i) => Math.abs(v - old[i]) <= 1), `${c}: ${L.catDisc[c]}, was rgb(${old.join(",")})`);
  }
  assert.strictEqual(L.glyphBg, L.chip);
});

// The dark map (Protomaps' dark flavour with DARK_MAP_LABELS, src/lib/mapStyle.ts).
console.log("dark map");
const lightMap = namedFlavor("light") as unknown as Record<string, string>;
const darkMap = { ...(namedFlavor("dark") as unknown as Record<string, string>), ...DARK_MAP_LABELS } as Record<string, string>;
for (const label of Object.keys(DARK_MAP_LABELS)) {
  const r = contrast(darkMap[label], darkMap[label + "_halo"]);
  const was = contrast(lightMap[label], lightMap[label + "_halo"]);
  rows.push(`dark   map ${label.padEnd(42)} ${darkMap[label]} on ${darkMap[label + "_halo"]}  ${r.toFixed(2)}`);
  test(`${label} on its halo: ${r.toFixed(2)} >= 4.5 and >= light's ${was.toFixed(2)}`, () => assert.ok(r >= TEXT && r >= was, `${r.toFixed(2)}:1`));
}
// River, lake and sea names, region names and country names (DARK_MAP_LABELS_MORE in
// src/ui/mapPalette.ts), each on what Protomaps draws under it: were 2.7, 1.5 and 2.5:1.
const MORE_UNDER: Record<string, string> = { ocean_label: "water", state_label: "state_label_halo", country_label: "earth" };
const darkMapAll = { ...darkMap, ...DARK_MAP_LABELS_MORE } as Record<string, string>;
test("every extra dark label has a known background", () =>
  assert.deepStrictEqual(Object.keys(DARK_MAP_LABELS_MORE).sort(), Object.keys(MORE_UNDER).sort()));
for (const [label, under] of Object.entries(MORE_UNDER)) {
  const r = contrast(darkMapAll[label], darkMapAll[under]);
  const was = contrast(lightMap[label], lightMap[under]);
  rows.push(`dark   map ${label.padEnd(42)} ${darkMapAll[label]} on ${darkMapAll[under]}  ${r.toFixed(2)}`);
  test(`${label} on ${under}: ${r.toFixed(2)} >= 4.5 and >= light's ${was.toFixed(2)}`, () => assert.ok(r >= TEXT && r >= was, `${r.toFixed(2)}:1`));
}
test("the extra dark labels stay below the city names (cities first)", () => {
  for (const label of Object.keys(DARK_MAP_LABELS_MORE))
    assert.ok(luminance(darkMapAll[label]) <= luminance(darkMapAll.city_label), `${label} ${darkMapAll[label]} is brighter than city_label`);
});

// Markers: the dark category colours against what lies under them on the dark map.
const UNDER = ["earth", "buildings", "minor_a", "major", "highway", "water", "park_b"];
test("dark markers (cat) stand out from the dark map: >= 3", () => {
  for (const [c, colour] of Object.entries(PALETTES.dark.cat)) for (const u of UNDER) {
    const r = contrast(colour, darkMap[u]);
    assert.ok(r >= UI, `${c} ${colour} on ${u} ${darkMap[u]}: ${r.toFixed(2)}`);
  }
});

// The marker's rings (src/ui/PlaceMap.tsx): a white ring inside a dark one. Whatever lies
// under a marker, one of the two is its edge at 3:1 or more: the dark ring on the light
// map (with the white ring alone, shop amber was 1.6:1 on light land), the white ring on
// the dark map. Checked on every map colour a marker can sit on, also parks and woods.
console.log("marker rings");
const MAP_UNDER = [...UNDER, "background", "park_a", "wood_a", "wood_b", "scrub_b", "sand", "pedestrian", "minor_b", "link"];
test("light map: the dark outer ring >= 3 on every map colour", () => {
  for (const u of MAP_UNDER) {
    const r = contrast(MARKER_RING.outer, lightMap[u]);
    assert.ok(r >= UI, `outer ${MARKER_RING.outer} on ${u} ${lightMap[u]}: ${r.toFixed(2)}`);
  }
});
test("dark map: the white inner ring >= 3 on every map colour", () => {
  for (const u of MAP_UNDER) {
    const r = contrast(MARKER_RING.inner, darkMap[u]);
    assert.ok(r >= UI, `inner ${MARKER_RING.inner} on ${u} ${darkMap[u]}: ${r.toFixed(2)}`);
  }
});
test("the two rings are apart (>= 3), so each shows against the other", () =>
  assert.ok(contrast(MARKER_RING.inner, MARKER_RING.outer) >= UI));
// The same marker as the dot on Find's category chips (the map's legend): one of its
// rings stands out on the chip (C.card) and, when the chip is chosen, on its catDisc.
for (const scheme of ["light", "dark"] as Scheme[]) {
  const C = PALETTES[scheme];
  test(`${scheme}: the legend dot's rings, one of them >= 3 on the chip and on every catDisc`, () => {
    const under: [string, string][] = [["card", C.card], ...Object.entries(C.catDisc).map(([c, d]) => [`catDisc ${c}`, d] as [string, string])];
    for (const [what, bg] of under) {
      const r = Math.max(contrast(MARKER_RING.inner, bg), contrast(MARKER_RING.outer, bg));
      assert.ok(r >= UI, `rings on ${what} ${bg}: ${r.toFixed(2)}`);
    }
  });
}

if (process.argv.includes("--table")) console.log("\n" + rows.join("\n"));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
