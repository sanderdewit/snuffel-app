// Run with:  node tests/i18n-app.test.mjs [codes...]
// Checks the app-only texts (src/i18n/app/<code>.json) against English: same
// keys, same {placeholders}, and plural objects with exactly the CLDR categories
// the language uses (Intl.PluralRules). Shared texts are checked in snuffel-data.
import fs from "node:fs";
import path from "node:path";

const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..", "src", "i18n");
const registry = JSON.parse(fs.readFileSync(path.join(dir, "packs", "languages.json"), "utf8"));
const only = process.argv.slice(2);
const codes = registry.languages.map((l) => l.code).filter((c) => !only.length || only.includes(c));
const en = JSON.parse(fs.readFileSync(path.join(dir, "app", "en.json"), "utf8"));
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

let problems = 0;
const fail = (code, msg) => { problems++; console.log(`  ${code}: ${msg}`); };
for (const code of codes) {
  const file = path.join(dir, "app", code + ".json");
  if (!fs.existsSync(file)) { fail(code, "missing src/i18n/app/" + code + ".json"); continue; }
  let pack;
  try { pack = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { fail(code, "invalid JSON: " + e.message); continue; }
  const cats = new Intl.PluralRules(code).resolvedOptions().pluralCategories.sort().join(",");
  for (const key of Object.keys(en)) {
    const want = en[key], got = pack[key];
    if (got == null) { fail(code, `missing ${key}`); continue; }
    if (typeof want === "string") {
      if (typeof got !== "string" || !got.trim()) { fail(code, `${key} must be a non-empty string`); continue; }
      if (vars(got) !== vars(want)) fail(code, `${key} placeholders {${vars(got)}} != {${vars(want)}}`);
    } else {
      if (typeof got !== "object") { fail(code, `${key} must be a plural object`); continue; }
      if (Object.keys(got).sort().join(",") !== cats) fail(code, `${key} plural categories ${Object.keys(got).sort()} != ${cats}`);
      for (const [cat, s] of Object.entries(got)) if (vars(s) !== vars(want.other)) fail(code, `${key}.${cat} placeholders {${vars(s)}} != {${vars(want.other)}}`);
    }
  }
  for (const key of Object.keys(pack)) if (!(key in en)) fail(code, `unknown key ${key}`);
}
console.log(problems ? `\n${problems} problem(s)` : `all ${codes.length} language(s) ok`);
process.exit(problems ? 1 : 0);
