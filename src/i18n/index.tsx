// Same packs and plural handling as the website (shared from snuffel-data),
// plus app-only texts from src/i18n/app/. The phone's language is used unless
// the user picks one in Settings.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import { PACKS, REGISTRY } from "./packs";
import { pluralCategory } from "./plural";
import { kvGet, kvSet } from "../lib/db";

type Vars = Record<string, string | number>;
export interface I18n {
  lang: string;
  choice: string | null;                   // null = follow the phone
  t: (key: string) => string;
  tf: (key: string, vars?: Vars) => string;
  setLanguage: (code: string | null) => void;
}

const reg = REGISTRY as { languages: { code: string; name: string }[]; aliases?: Record<string, string> };
export const LANGUAGES = reg.languages;
const ALIASES = reg.aliases || {};

export function phoneLanguage(): string {
  for (const l of getLocales()) {
    const code = (l.languageCode || "").toLowerCase();
    if (PACKS[code]) return code;
    if (ALIASES[code] && PACKS[ALIASES[code]]) return ALIASES[code];
  }
  return "en";
}

function lookup(lang: string, key: string): unknown {
  const v = PACKS[lang] && PACKS[lang][key];
  return v == null ? (PACKS.en[key] ?? key) : v;
}

export function translate(lang: string, key: string, vars?: Vars): string {
  let v = lookup(lang, key);
  if (v && typeof v === "object") {
    const cat = pluralCategory(lang, Number(vars && vars.n));   // Hermes has no Intl.PluralRules
    const forms = v as Record<string, string>;
    v = forms[cat] ?? forms.other;
  }
  return String(v).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => { kvGet("lang").then((c) => { if (c && PACKS[c]) setChoice(c); }).catch(() => undefined); }, []);
  const lang = choice || phoneLanguage();
  const setLanguage = useCallback((code: string | null) => {
    setChoice(code && PACKS[code] ? code : null);
    kvSet("lang", code && PACKS[code] ? code : null).catch(() => undefined);
  }, []);
  const value = useMemo<I18n>(() => ({
    lang, choice,
    t: (key) => translate(lang, key),
    tf: (key, vars) => translate(lang, key, vars),
    setLanguage
  }), [lang, choice, setLanguage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
