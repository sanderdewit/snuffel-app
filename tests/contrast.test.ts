// Run with:  node tests/contrast.test.ts
// WCAG AA contrast of the main text/background pairs, in the light and the dark
// palette (src/ui/palette.ts): 4.5:1 for text, 3:1 for UI (spinners, borders,
// the switch). Also: the AI's urgency colours stay apart from each other.
import assert from "node:assert";
import { PALETTES, type Palette, type Scheme, type UrgencyLevel } from "../src/ui/palette.ts";

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
  ["white knob on toggleOn", () => "#ffffff", (C) => C.toggleOn, UI]
];

const rows: string[] = [];
for (const scheme of ["light", "dark"] as Scheme[]) {
  const C = PALETTES[scheme];
  console.log(scheme);
  test("every colour is a 6-digit hex (the category tints append an alpha)", () => {
    const all = Object.values(C).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v as Record<string, string>)));
    for (const v of all) assert.match(v, /^#[0-9a-f]{6}$/, v);
  });
  for (const [what, fg, bg, min] of PAIRS) {
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
});

if (process.argv.includes("--table")) console.log("\n" + rows.join("\n"));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
