// Run with:  node tests/breeds.test.ts
// The breed picker's search, the match of old free-text breeds, and what is shown and sent.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { breedForServer, breedLabel, cleanChoice, distance, makeIndex, matchFreeText, norm, searchBreeds, type BreedList } from "../src/lib/breedsearch.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}
const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "src/core/breeds.json"), "utf8")) as BreedList;
const langs = (JSON.parse(fs.readFileSync(path.join(root, "src/i18n/packs/languages.json"), "utf8")) as { languages: { code: string }[] }).languages.map((l) => l.code);
const en = JSON.parse(fs.readFileSync(path.join(root, "src/i18n/app/en.json"), "utf8")) as Record<string, string>;
const ix = makeIndex(data);
const first = (q: string, lang = "en") => searchBreeds(ix, q, lang)[0]?.id;
const t = (k: string) => en[k] ?? k;
const tf = (k: string, v: Record<string, string | number>) => t(k).replace(/\{(\w+)\}/g, (_, n) => String(v[n]));

console.log("breeds");

test("the bundled list has a name in every app language", () => {
  assert.ok(data.breeds.length > 400);
  for (const b of data.breeds) for (const l of langs) assert.ok(b.names[l]?.trim(), `${b.id} ${l}`);
});

test("no query: mixed first, then common breeds, other last", () => {
  const all = searchBreeds(ix, "", "nl");
  assert.strictEqual(all[0].id, "mixed");
  assert.strictEqual(all[1].id, "fci-122");
  assert.strictEqual(all[all.length - 1].id, "other");
  assert.strictEqual(all.length, ix.all.length);
});

test("search in the app's language, and on names in other languages", () => {
  assert.strictEqual(first("labrador", "nl"), "fci-122");
  assert.strictEqual(first("Duitse herder", "nl"), "fci-166");
  assert.strictEqual(first("German shepherd", "nl"), "fci-166");
  assert.strictEqual(first("Deutscher Schäferhund", "fr"), "fci-166");
  assert.strictEqual(first("malinois", "de"), "fci-15-malinois");
  assert.strictEqual(first("cockapoo", "it"), "x-cockapoo");
});

test("search ignores accents and case", () => {
  assert.strictEqual(first("mayrakoira", "fi"), "fci-148");
  assert.strictEqual(first("BOULEDOGUE FRANCAIS", "fr"), "fci-101");
  assert.strictEqual(first("schaferhund", "de"), "fci-166");
});

test("search forgives small typos", () => {
  assert.strictEqual(first("labardor"), "fci-122");
  assert.strictEqual(first("chiuaua"), "fci-218");
  assert.strictEqual(first("dobberman"), "fci-143");
  assert.strictEqual(first("rotweiler"), "fci-147");
});

test("other is always offered, and exclude works", () => {
  const r = searchBreeds(ix, "zzzzqqq", "en");
  assert.deepStrictEqual(r.map((b) => b.id), ["other"]);
  const mainly = searchBreeds(ix, "", "en", { exclude: ["mixed", "other", "fci-122"] });
  assert.ok(!mainly.some((b) => ["mixed", "other", "fci-122"].includes(b.id)));
});

test("old free text: typos, spaces and local names get the right id", () => {
  const id = (s: string) => matchFreeText(ix, s)?.breedId;
  assert.strictEqual(id("labardor"), "fci-122");
  assert.strictEqual(id("Duitse Herder "), "fci-166");
  assert.strictEqual(id("Bobtail"), "fci-16");
  assert.strictEqual(id("golden"), "fci-111");
  assert.strictEqual(id("cocker"), "fci-5");
  assert.strictEqual(id("Mechelse herder"), "fci-15-malinois");
  assert.strictEqual(id("toy poedel"), "fci-172-toy");
  assert.strictEqual(id("Cavapoo"), "x-cavapoo");
  assert.strictEqual(id("pitbull"), "nf-american-pit-bull-terrier");
});

test("old free text: a mix becomes mixed, with up to two main breeds", () => {
  assert.deepStrictEqual(matchFreeText(ix, "Teckelmix"), { breedId: "mixed", breed: null, breedSize: null, breedMix: ["fci-148"] });
  assert.deepStrictEqual(matchFreeText(ix, "Labrador x Husky")?.breedMix, ["fci-122", "fci-270"]);
  assert.deepStrictEqual(matchFreeText(ix, "kruising"), { breedId: "mixed", breed: null, breedSize: null, breedMix: [] });
});

test("old free text that matches nothing stays as other, text kept", () => {
  assert.deepStrictEqual(matchFreeText(ix, "Vuurspuwende draak"), { breedId: "other", breed: "Vuurspuwende draak", breedSize: null, breedMix: [] });
  assert.strictEqual(matchFreeText(ix, "  "), null);
});

test("labels in the app", () => {
  assert.strictEqual(breedLabel(ix, { breedId: "fci-122" }, "nl", t, tf), "Labrador Retriever");
  assert.strictEqual(breedLabel(ix, { breedId: "mixed", breedSize: "medium", breedMix: ["fci-122"] }, "en", t, tf), "Mixed breed · Medium · mainly Labrador Retriever");
  assert.strictEqual(breedLabel(ix, { breedId: "other", breed: "Kai Ken mix" }, "en", t, tf), "Kai Ken mix");
  assert.strictEqual(breedLabel(ix, { breedId: null, breed: "labardor" }, "en", t, tf), "labardor");
  assert.strictEqual(breedLabel(ix, { breedId: null, breed: null }, "en", t, tf), null);
});

test("sent to the server: the id and the English name (older servers read breed)", () => {
  assert.deepStrictEqual(breedForServer(ix, { breedId: "fci-166" }), { breedId: "fci-166", breed: "German Shepherd" });
  assert.deepStrictEqual(breedForServer(ix, { breedId: "mixed", breedSize: "large", breedMix: ["fci-122", "fci-172"] }),
    { breedId: "mixed", breed: "Labrador Retriever / Poodle mix", breedSize: "large" });
  assert.deepStrictEqual(breedForServer(ix, { breedId: "mixed", breedMix: [] }), { breedId: "mixed", breed: "Mixed breed" });
  assert.deepStrictEqual(breedForServer(ix, { breedId: "other", breed: "Kai Ken mix" }), { breedId: "other", breed: "Kai Ken mix" });
  assert.deepStrictEqual(breedForServer(ix, { breedId: null, breed: "labardor" }), { breed: "labardor" });
  assert.deepStrictEqual(breedForServer(ix, { breedId: null, breed: null }), {});
});

test("cleanChoice: unknown ids dropped, size and mainly only for mixed", () => {
  assert.deepStrictEqual(cleanChoice(ix, { breedId: "fci-9999", breed: "x" }), { breedId: null, breed: "x", breedSize: null, breedMix: [] });
  assert.deepStrictEqual(cleanChoice(ix, { breedId: "fci-122", breed: "old", breedSize: "large", breedMix: ["fci-5"] }), { breedId: "fci-122", breed: null, breedSize: null, breedMix: [] });
  assert.deepStrictEqual(cleanChoice(ix, { breedId: "mixed", breedSize: "huge" as never, breedMix: ["fci-122", "mixed", "fci-122", "nope", "fci-5", "fci-166"] }),
    { breedId: "mixed", breed: null, breedSize: null, breedMix: ["fci-122", "fci-5"] });
});

test("norm and distance", () => {
  assert.strictEqual(norm("Mäyräkoira"), "mayrakoira");
  assert.strictEqual(norm(" Shih-Tzu! "), "shih tzu");
  assert.strictEqual(norm("Großspitz"), "grossspitz");
  assert.strictEqual(distance("labardor", "labrador"), 1);
  assert.strictEqual(distance("beagle", "beagle"), 0);
  assert.ok(distance("husky", "pointer") > 3);
});

test("search is quick enough to run on every keystroke", () => {
  const start = Date.now();
  for (const q of ["l", "la", "lab", "labr", "labra", "labrad", "labrado", "labrador", "pud", "pudel", "kees", "keeshond", "chiuaua", "x"]) searchBreeds(ix, q, "nl");
  assert.ok(Date.now() - start < 2000, `${Date.now() - start} ms`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
