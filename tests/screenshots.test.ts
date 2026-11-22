// Run with:  node tests/screenshots.test.ts
// Store screenshots: the sample content of screenshot mode exists in every app language
// (src/lib/demotexts.ts), and store/locales.json maps every app language to a phone
// locale, the App Store locales (fastlane/metadata) and the Google Play locales
// (fastlane/android-metadata/whatsnew) exactly once.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { DEMO_TEXTS, demoTexts } from "../src/lib/demotexts.ts";

const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const CODES: string[] = read("src/i18n/packs/languages.json").languages.map((l: { code: string }) => l.code).sort();
const LOCALES: Record<string, { locale: string; appStore: string | null; play: string }> = read("store/locales.json").languages;

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}
const words = (s: string) => s.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

console.log("screenshots");

test("sample texts for every app language, nothing else", () => {
  assert.deepStrictEqual(Object.keys(DEMO_TEXTS).sort(), CODES);
});

test("every sample text is filled in, with the same fields as English", () => {
  const keys = Object.keys(DEMO_TEXTS.en).sort();
  for (const [lang, tx] of Object.entries(DEMO_TEXTS)) {
    assert.deepStrictEqual(Object.keys(tx).sort(), keys, lang);
    for (const [k, v] of Object.entries(tx)) assert.ok(typeof v === "string" && v.trim() === v && v.length > 1, `${lang}.${k}`);
  }
});

test("the question names Bobbie and asks something", () => {
  for (const [lang, tx] of Object.entries(DEMO_TEXTS)) {
    assert.ok(tx.question.includes("Bobbie"), lang);
    assert.ok(/[?;]$/.test(tx.question), `${lang} ends with a question mark`);
  }
});

test("no texts outside the app languages: English as the fallback", () => {
  assert.strictEqual(demoTexts("xx"), DEMO_TEXTS.en);
  assert.strictEqual(demoTexts("nl"), DEMO_TEXTS.nl);
});

// The AI answers in the owner's form of address, formal without a cue in these
// languages. Where the app itself is informal, the question addresses it informally.
test("the question gives the AI the app's form of address", () => {
  const informalCue: Record<string, string> = { de: "du", et: "sa", hr: "ti", hu: "te", it: "tu", lv: "tev", mk: "ти", pl: "ciebie", ro: "tu", sq: "ti", sr: "ti" };
  for (const [lang, cue] of Object.entries(informalCue)) assert.ok(words(DEMO_TEXTS[lang].question).includes(cue), `${lang} has "${cue}"`);
  const notInFormal: Record<string, string[]> = {
    bg: ["ти", "теб", "твой"], cs: ["ty", "tě", "tvůj"], el: ["σε", "σου", "εσύ"], fr: ["tu", "ton", "ta", "tes"], lt: ["tu", "tau", "tavo"],
    pt: ["tu", "te", "teu", "tua"], sk: ["ty", "ťa", "tvoj"], sl: ["ti", "tebi", "tvoj"], uk: ["ти", "тобі", "твій"]
  };
  for (const [lang, bad] of Object.entries(notInFormal)) for (const b of bad) assert.ok(!words(DEMO_TEXTS[lang].question).includes(b), `${lang} has "${b}"`);
});

test("locales.json covers every app language once, with a phone locale of that language", () => {
  assert.deepStrictEqual(Object.keys(LOCALES).sort(), CODES);
  for (const [lang, l] of Object.entries(LOCALES)) assert.match(l.locale, new RegExp(`^${lang}(-[A-Z][a-z]{3})?-[A-Z]{2}$`), lang);
});

test("App Store: every fastlane/metadata locale gets exactly one app language", () => {
  const dir = path.join(root, "fastlane", "metadata");
  const folders = fs.readdirSync(dir).filter((f) => f !== "review_information" && fs.statSync(path.join(dir, f)).isDirectory()).sort();
  const mapped = Object.values(LOCALES).map((l) => l.appStore).filter((a): a is string => a !== null);
  assert.deepStrictEqual([...mapped].sort(), folders);
  assert.strictEqual(new Set(mapped).size, mapped.length);
  assert.strictEqual(LOCALES.nb.appStore, "no");
});

test("Google Play: every whatsnew locale gets exactly one app language", () => {
  const files = fs.readdirSync(path.join(root, "fastlane", "android-metadata", "whatsnew")).map((f) => f.replace(/^whatsnew-/, "")).sort();
  const mapped = Object.values(LOCALES).map((l) => l.play);
  assert.deepStrictEqual([...mapped].sort(), files);
  assert.strictEqual(new Set(mapped).size, mapped.length);
  assert.strictEqual(LOCALES.nb.play, "no-NO");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
