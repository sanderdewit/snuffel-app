// Run with:  node tests/plural.test.ts
// Our plural rules must match CLDR (Node's Intl.PluralRules) for every language
// the app ships, for whole numbers 0..10 000 and large round numbers.
import fs from "node:fs";
import path from "node:path";
import { pluralCategory } from "../src/i18n/plural.ts";

const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..", "src", "i18n", "packs");
const codes: string[] = JSON.parse(fs.readFileSync(path.join(dir, "languages.json"), "utf8")).languages.map((l: { code: string }) => l.code);
const numbers = [...Array(10001).keys(), 100000, 1000000, 2000000, 1500000, 10000000, 1000001, 21000000];

let failed = 0;
for (const code of codes) {
  const rules = new Intl.PluralRules(code);
  const bad = numbers.filter((n) => rules.select(n) !== pluralCategory(code, n));
  if (bad.length) { failed++; console.log(`  FAIL ${code}: e.g. ${bad.slice(0, 5).map((n) => `${n} -> ${pluralCategory(code, n)} (CLDR ${rules.select(n)})`).join(", ")}`); }
}
console.log(failed ? `\n${failed} language(s) differ` : `plural rules match CLDR for all ${codes.length} languages`);
process.exit(failed ? 1 : 0);
