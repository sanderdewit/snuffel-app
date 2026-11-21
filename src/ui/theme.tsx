// Light and dark: the colours (palette.ts) and the shared styles, per scheme.
// Components read both from useTheme() and re-render when the scheme changes
// (the phone switches at sunset, or the owner picks Light or Dark in Settings);
// nothing is remounted, so screens keep their state.
//
// The choice is kept on the phone (kv "appearance": "light" | "dark", absent =
// follow the phone). It is read synchronously at start, so an owner who picked
// Dark never sees a light first frame. Appearance.setColorScheme() makes the
// native parts follow it too: alerts, the date picker, the keyboard.
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from "expo-router";
import { kvGetSync, kvSet } from "../lib/db";
import { PALETTES, type Palette, type Scheme } from "./palette";

export type { Palette, Scheme } from "./palette";

/** Light or Dark chosen in Settings; null = follow the phone. */
export type AppearanceChoice = Scheme | null;

function makeStyles(C: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    pad: { padding: 16 },
    card: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
    h1: { fontSize: 22, fontWeight: "700", color: C.text },
    h2: { fontSize: 17, fontWeight: "700", color: C.text },
    body: { fontSize: 15, color: C.text, lineHeight: 21 },
    muted: { fontSize: 13, color: C.muted, lineHeight: 18 },
    row: { flexDirection: "row", alignItems: "center" },
    input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.fieldLine, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.text },
    btn: { backgroundColor: C.brand, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
    btnText: { color: C.onBrand, fontSize: 16, fontWeight: "700" },
    btnGhost: { backgroundColor: C.chip, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
    btnGhostText: { color: C.text, fontSize: 15, fontWeight: "600" },
    // Feedback while a card, row or button is held down: <Pressable style={({ pressed }) => [S.card, pressed && S.pressed]}>
    pressed: { opacity: 0.6 }
  });
}

/** React Navigation's colours: navigation header, tab bar, screen background. */
function navigationTheme(scheme: Scheme, C: Palette): NavigationTheme {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, primary: C.link, background: C.bg, card: C.card, text: C.text, border: C.line, notification: C.dangerFill }
  };
}

interface SchemeTheme {
  scheme: Scheme;
  C: Palette;
  S: ReturnType<typeof makeStyles>;
  navigation: NavigationTheme;
}
// Built once per scheme: switching only swaps which one is handed out.
const THEMES: Record<Scheme, SchemeTheme> = {
  light: { scheme: "light", C: PALETTES.light, S: makeStyles(PALETTES.light), navigation: navigationTheme("light", PALETTES.light) },
  dark: { scheme: "dark", C: PALETTES.dark, S: makeStyles(PALETTES.dark), navigation: navigationTheme("dark", PALETTES.dark) }
};

export interface Theme extends SchemeTheme {
  appearance: AppearanceChoice;
  setAppearance: (choice: AppearanceChoice) => void;
}

const STORE_KEY = "appearance";
const storedChoice = (): AppearanceChoice => {
  const v = kvGetSync(STORE_KEY);
  return v === "light" || v === "dark" ? v : null;
};

const Ctx = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setChoice] = useState<AppearanceChoice>(storedChoice);
  const phone = useColorScheme();
  const scheme: Scheme = appearance ?? (phone === "dark" ? "dark" : "light");

  // Native parts follow a choice too; "unspecified" hands them back to the phone.
  // Nothing is set as long as no choice was made.
  const overridden = useRef(false);
  useLayoutEffect(() => {
    if (!appearance && !overridden.current) return;
    Appearance.setColorScheme(appearance ?? "unspecified");
    overridden.current = !!appearance;
  }, [appearance]);

  const setAppearance = useCallback((choice: AppearanceChoice) => {
    setChoice(choice);
    kvSet(STORE_KEY, choice).catch(() => undefined);
  }, []);

  const value = useMemo<Theme>(() => ({ ...THEMES[scheme], appearance, setAppearance }), [scheme, appearance, setAppearance]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The current scheme's colours `C` and styles `S` (and the Appearance setting). */
export function useTheme(): Theme {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme outside ThemeProvider");
  return v;
}
