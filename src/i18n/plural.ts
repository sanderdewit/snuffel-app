// CLDR plural categories for whole numbers in our 29 languages. The app's
// JavaScript engine (Hermes) has no Intl.PluralRules, and calling it crashed
// every screen with a count. tests/plural.test.ts checks these rules against
// Node's Intl.PluralRules for 0..10 000 and large round numbers.
export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

const between = (x: number, a: number, b: number) => x >= a && x <= b;
// Languages with "many" for exact millions (1 000 000, 2 000 000, ...).
const millions = (n: number): PluralCategory | null => (n !== 0 && n % 1000000 === 0 ? "many" : null);

export function pluralCategory(lang: string, value: number): PluralCategory {
  const n = Math.abs(Math.trunc(value));
  const n10 = n % 10, n100 = n % 100;
  const slavic = (): PluralCategory =>   // ru-style: one / few / many
    n10 === 1 && n100 !== 11 ? "one" : between(n10, 2, 4) && !between(n100, 12, 14) ? "few" : "many";
  switch (lang) {
    case "fr": return n === 0 || n === 1 ? "one" : millions(n) || "other";
    case "pt": return n === 0 || n === 1 ? "one" : millions(n) || "other";
    case "es": case "it": case "ca": return n === 1 ? "one" : millions(n) || "other";
    case "lv": return n10 === 0 || between(n100, 11, 19) ? "zero" : n10 === 1 && n100 !== 11 ? "one" : "other";
    case "lt": return between(n100, 11, 19) ? "other" : n10 === 1 ? "one" : n10 >= 2 ? "few" : "other";
    case "pl": return n === 1 ? "one" : between(n10, 2, 4) && !between(n100, 12, 14) ? "few" : "many";
    case "uk": return slavic();
    case "cs": case "sk": return n === 1 ? "one" : between(n, 2, 4) ? "few" : "other";
    case "hr": case "sr": case "bs": {
      const c = slavic();
      return c === "many" ? "other" : c;
    }
    case "sl": return n100 === 1 ? "one" : n100 === 2 ? "two" : between(n100, 3, 4) ? "few" : "other";
    case "ro": return n === 1 ? "one" : n === 0 || between(n100, 1, 19) ? "few" : "other";
    case "is": case "mk": return n10 === 1 && n100 !== 11 ? "one" : "other";
    default:   // en, nl, de, da, sv, nb, fi, et, hu, el, bg, sq: one / other
      return n === 1 ? "one" : "other";
  }
}
