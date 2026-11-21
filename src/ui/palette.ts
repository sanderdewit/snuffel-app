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
  cat: Record<Category, string>;           // category dots, chips and map markers
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
  // the website's marker colours
  cat: {
    vet: "#2563eb", hospital: "#dc2626", grooming: "#db2777", shop: "#f59e0b",
    boarding: "#7c3aed", training: "#0f766e", play: "#16a34a", shelter: "#0891b2"
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
  // the same hues, lighter: visible on dark cards and on the dark map
  cat: {
    vet: "#60a5fa", hospital: "#f87171", grooming: "#f472b6", shop: "#fbbf24",
    boarding: "#a78bfa", training: "#2dd4bf", play: "#4ade80", shelter: "#22d3ee"
  }
};

export const PALETTES: Record<Scheme, Palette> = { light: LIGHT, dark: DARK };
