// The app's colours, light and dark, by role. Plain data (no React Native) so
// tests/contrast.test.ts can check every text/background pair against WCAG AA.
// Screens never use a colour directly: they take `C` from useTheme() (theme.tsx).
//
// Light is the palette the app always had. A few colours are a shade darker
// (same hue, just enough to pass 4.5:1 on the grey chips): brand #ea580c ->
// #ca4c0a (white button text), muted #64748b -> #59687c, danger text #dc2626 ->
// #d62525, ok text #16a34a -> #117f3a, warn #d97706 -> #a75b05.
//
// Dark keeps the same orange for filled buttons (white text on it), and uses
// lighter tints for orange, red, green, amber and blue *text*, so they stay
// readable on the dark slate surfaces.
//
// Emoji can't follow the scheme, and many are drawn in black or dark grey: 🩺 vet,
// 🎓 training, 🐾 shelter and the app's paw, 🎧 conversation mode. On the dark card
// such a glyph is about 1:1 (gone); on light it is 12:1. So in dark mode an emoji that
// has to be seen sits on a light disc (catDisc, glyphBg; see src/ui/Emoji.tsx).
import type { Category } from "../core/classify";

export type Scheme = "light" | "dark";
export type UrgencyLevel = "emergency" | "vet_today" | "vet_soon" | "monitor";

export interface Palette {
  bg: string;          // screen background
  card: string;        // cards, inputs, sheets, navigation header, tab bar
  chip: string;        // ghost buttons, unselected chips, quiet panels
  line: string;        // borders and dividers (also the background of [name] labels)
  text: string;        // body text
  muted: string;       // secondary text, placeholders; readable on bg, card, chip and line
  link: string;        // orange text: links, header buttons, small actions, step numbers
  brand: string;       // orange fill with onBrand text: buttons, selected chips; spinners
  brandDark: string;   // deeper orange fill with onBrand text: own messages, the chosen dog, Send
  onBrand: string;     // text and spinners on brand, brandDark and dangerFill
  strong: string;      // neutral high-emphasis fill (Directions, the chosen radius)
  onStrong: string;    // text on strong
  danger: string;      // red text: errors, overdue, Delete, the emergency tab
  dangerFill: string;  // red buttons (onBrand text): call, find an open vet, hang up
  ok: string;          // green text: open now, independent, done
  warn: string;        // amber text: warnings, chains, "vet soon"
  urgency: Record<UrgencyLevel, string>;   // the AI's triage label, on bg, card and chip
  alertBg: string;     // the emergency banner (Emergency tab, AI help)
  alertLine: string;
  alertText: string;
  noteBg: string;      // a chat bubble from the app itself (an error), not from the AI
  toggleOn: string;    // switch track (the knob is white in both)
  toggleOff: string;
  fieldLine: string;   // the border of text fields and pickers (S.input)
  glyphBg: string;     // the disc behind an emoji that has to be seen: icon-only buttons (mic, conversation mode), the paw by the name
  cat: Record<Category, string>;           // category dots, chips and map markers
  catDisc: Record<Category, string>;       // the disc behind a category's icon (place cards, Find chips, the place title)
  catInk: Record<Category, string>;        // the category's icon on that disc: a deep shade of its hue (4.5:1 or more on the disc)
}

const lightDanger = "#d62525", lightWarn = "#a75b05", lightOrangeText = "#c2410c";

export const LIGHT: Palette = {
  bg: "#f8fafc",
  card: "#ffffff",
  chip: "#f1f5f9",
  line: "#e2e8f0",
  text: "#0f172a",
  muted: "#59687c",
  link: lightOrangeText,
  brand: "#ca4c0a",
  brandDark: "#c2410c",
  onBrand: "#ffffff",
  strong: "#0f172a",
  onStrong: "#ffffff",
  danger: lightDanger,
  dangerFill: "#dc2626",
  ok: "#117f3a",
  warn: lightWarn,
  // "keep an eye on it" is blue, not green (green reads as "all fine"); "today" sits between amber and red
  urgency: { emergency: lightDanger, vet_today: lightOrangeText, vet_soon: lightWarn, monitor: "#1d4ed8" },
  alertBg: "#fef2f2",
  alertLine: "#fecaca",
  alertText: "#7f1d1d",
  noteBg: "#fff7ed",
  toggleOn: "#16a34a",
  toggleOff: "#cbd5e1",
  // As before. (Against the screen this is 1.2:1, below the 3:1 asked for a field's
  // edge in WCAG 1.4.11: a darker border here is the owner's choice, it changes the look.)
  fieldLine: "#e2e8f0",
  glyphBg: "#f1f5f9",   // = chip: light mode looks as before
  // the website's marker colours
  cat: {
    vet: "#2563eb", hospital: "#dc2626", grooming: "#db2777", shop: "#f59e0b",
    boarding: "#7c3aed", training: "#0f766e", play: "#16a34a", shelter: "#0891b2"
  },
  // The tint the place cards always had (the category colour at 0x22 alpha on the white card)
  catDisc: {
    vet: "#e2eafc", hospital: "#fae2e2", grooming: "#fae2ed", shop: "#fef2de",
    boarding: "#eee5fd", training: "#dfedec", play: "#e0f3e7", shelter: "#def0f5"
  },
  // The category's icon on its disc, both schemes: a deep shade of the same hue (Tailwind 800)
  catInk: {
    vet: "#1e40af", hospital: "#991b1b", grooming: "#9d174d", shop: "#92400e",
    boarding: "#5b21b6", training: "#115e59", play: "#166534", shelter: "#155e75"
  }
};

const darkDanger = "#f87171", darkWarn = "#fbbf24", darkOrangeText = "#fb923c";

export const DARK: Palette = {
  bg: "#0f172a",
  card: "#1e293b",
  chip: "#273449",
  line: "#334155",
  text: "#f1f5f9",
  muted: "#a1aec0",
  link: darkOrangeText,
  brand: "#ca4c0a",
  brandDark: "#c2410c",
  onBrand: "#ffffff",
  strong: "#cbd5e1",
  onStrong: "#0f172a",
  danger: darkDanger,
  dangerFill: "#dc2626",
  ok: "#4ade80",
  warn: darkWarn,
  urgency: { emergency: darkDanger, vet_today: darkOrangeText, vet_soon: darkWarn, monitor: "#60a5fa" },
  alertBg: "#450a0a",
  alertLine: "#7f1d1d",
  alertText: "#fecaca",
  noteBg: "#431407",
  toggleOn: "#16a34a",
  toggleOff: "#475569",
  fieldLine: "#64748b",  // `line` (1.4:1 on the card) left fields without a visible edge; this is 3:1 on card and bg
  glyphBg: "#cbd5e1",    // light, as `strong`: a black emoji on it is 10:1
  // the same hues, lighter: visible on dark cards and on the dark map
  cat: {
    vet: "#60a5fa", hospital: "#f87171", grooming: "#f472b6", shop: "#fbbf24",
    boarding: "#a78bfa", training: "#2dd4bf", play: "#4ade80", shelter: "#22d3ee"
  },
  // Light tints of the same hues (Tailwind 200), not the dark 0x22 tint: 🩺, 🎓 and 🐾
  // are drawn in black (1.3:1 on that dark tint, 10:1 or more on these). The hue still
  // matches the category's map marker.
  catDisc: {
    vet: "#bfdbfe", hospital: "#fecaca", grooming: "#fbcfe8", shop: "#fde68a",
    boarding: "#ddd6fe", training: "#99f6e4", play: "#bbf7d0", shelter: "#a5f3fc"
  },
  // The category's icon on its disc, both schemes: a deep shade of the same hue (Tailwind 800)
  catInk: {
    vet: "#1e40af", hospital: "#991b1b", grooming: "#9d174d", shop: "#92400e",
    boarding: "#5b21b6", training: "#115e59", play: "#166534", shelter: "#155e75"
  }
};

export const PALETTES: Record<Scheme, Palette> = { light: LIGHT, dark: DARK };

// Map labels in dark mode. Protomaps' dark flavour draws street names, house numbers
// and neighbourhoods in #525252 on a #1f1f1f halo (2.1:1; its light flavour has about
// 3.4:1) and city names at 3.8:1. These replace them (src/lib/mapStyle.ts): 4.5:1 or
// more on their halo. Light keeps Protomaps' own colours.
export const DARK_MAP_LABELS = {
  roads_label_minor: "#8c8c8c",
  roads_label_major: "#9c9c9c",
  subplace_label: "#8c8c8c",
  address_label: "#8c8c8c",
  city_label: "#b3b3b3"
};
