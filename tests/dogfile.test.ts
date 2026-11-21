// Run with:  node tests/dogfile.test.ts
// Password-protected export round trip, the summary sent to the AI, editing an entry
// (on Node's own SQLite, with the app's real migrations) and how the file is shown.
import assert from "node:assert";
import fs from "node:fs";
import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { gcm } from "@noble/ciphers/aes.js";
import { utf8ToBytes } from "@noble/ciphers/utils.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { b64, BadSealError, imageType, PasswordTooShortError, seal, SCRYPT, unseal, WrongPasswordError } from "../src/lib/seal.ts";
import { cleanRecord, RECORD_KINDS, recurring, SIGN_CATEGORIES, signCategory, summarise, SUMMARY_MAX, type DogRecord } from "../src/lib/dogsummary.ts";
import { SAME_EPISODE_MS, writeRecord, type SqlDb } from "../src/lib/records.ts";
import { byMonth, formatDayMonth, formatMonth, keyFacts, kindsIn } from "../src/lib/dogfileview.ts";

let passed = 0, failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}
const random = (n: number) => webcrypto.getRandomValues(new Uint8Array(n));
let id = 0;
const rec = (kind: DogRecord["kind"], date: string, title: string, extra: Partial<DogRecord> = {}): DogRecord =>
  ({ id: ++id, dogId: 1, kind, date, title, details: null, value: null, ...extra });

console.log("dog file");

await test("encrypted export opens with the right password only", async () => {
  const plain = JSON.stringify({ format: "snuffel-dog", dog: { name: "Bobbie 🐩" }, records: [{ title: "Oorontsteking" }] });
  const sealed = await seal(plain, "lange zin met spaties", random);
  assert.ok(!JSON.stringify(sealed).includes("Bobbie"), "name must not be readable");
  assert.strictEqual(await unseal(sealed, "lange zin met spaties"), plain);
  await assert.rejects(unseal(sealed, "verkeerd"), WrongPasswordError);
});

await test("a tampered file is rejected", async () => {
  const sealed = await seal("{}", "pw-lang-genoeg", random);
  const bytes = Uint8Array.from(atob(sealed.data), (c) => c.charCodeAt(0));
  bytes[0] ^= 1;
  await assert.rejects(unseal({ ...sealed, data: btoa(String.fromCharCode(...bytes)) }, "pw-lang-genoeg"), WrongPasswordError);
});

await test("new exports use scrypt N=2^16, r=8, p=1", async () => {
  const sealed = await seal("{}", "pw-lang-genoeg", random);
  assert.deepStrictEqual([sealed.N, sealed.r, sealed.p], [2 ** 16, 8, 1]);
  assert.deepStrictEqual(SCRYPT, { N: 2 ** 16, r: 8, p: 1 });
});

await test("an older export (N=2^14) still opens", async () => {
  const salt = random(16), nonce = random(12), plain = JSON.stringify({ format: "snuffel-dog", dog: { name: "Oud" } });
  const key = await scryptAsync(utf8ToBytes("oud wachtwoord"), salt, { N: 2 ** 14, r: 8, p: 1, dkLen: 32 });
  const old = { format: "snuffel-dog-encrypted" as const, version: 1 as const, kdf: "scrypt" as const, N: 2 ** 14, r: 8, p: 1,
    salt: b64.enc(salt), nonce: b64.enc(nonce), data: b64.enc(gcm(key, nonce).encrypt(utf8ToBytes(plain))) };
  assert.strictEqual(await unseal(old, "oud wachtwoord"), plain);
});

await test("crafted work factors are refused", async () => {
  const sealed = await seal("{}", "pw-lang-genoeg", random);
  for (const bad of [{ N: 2 ** 18 }, { r: 16 }, { p: 2 }, { N: 2 ** 24 }, { N: 2 ** 10 }, { N: "65536" as any }])
    await assert.rejects(unseal({ ...sealed, ...bad }, "pw-lang-genoeg"), BadSealError, JSON.stringify(bad));
});

await test("short passwords are refused", async () => {
  await assert.rejects(seal("{}", "123456789", random), PasswordTooShortError);
  await assert.rejects(seal("{}", "", random), PasswordTooShortError);
  await seal("{}", "1234567890", random);   // exactly 10 is fine
});

await test("imported photos: only real JPEG or PNG", () => {
  assert.strictEqual(imageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])), "jpg");
  assert.strictEqual(imageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), "png");
  assert.strictEqual(imageType(utf8ToBytes("<svg onload=alert(1)>")), null);
  assert.strictEqual(imageType(utf8ToBytes("GIF89a......")), null);
  assert.strictEqual(imageType(new Uint8Array(0)), null);
});

await test("summary: allergies, diagnoses, recent medication, weight trend, recent events", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const records = [   // newest first
    rec("ai", "2026-10-01", "Eet minder sinds gisteren"),
    rec("weight", "2026-09-20", "Weight", { value: 29.4 }),
    rec("medication", "2026-08-15", "Oordruppels", { details: "2x per dag, 7 dagen" }),
    rec("visit", "2026-08-15", "Oorontsteking links"),
    rec("weight", "2025-03-01", "Weight", { value: 27 }),
    rec("medication", "2025-01-10", "Old antibiotic"),
    rec("allergy", "2024-05-01", "Kip"),
    rec("diagnosis", "2023-02-01", "Heupdysplasie licht")
  ];
  const s = summarise(records, now)!;
  assert.match(s, /Allergies: Kip/);
  assert.match(s, /Diagnoses: 2023-02-01 Heupdysplasie licht/);
  assert.match(s, /Medication \(last 6 months\): 2026-08-15 Oordruppels \(2x per dag, 7 dagen\)/);
  assert.ok(!s.includes("Old antibiotic"), "old medication left out");
  assert.match(s, /Weight: 27 kg \(2025-03-01\) -> 29.4 kg \(2026-09-20\)/);
  assert.match(s, /asked AI: 2026-10-01 Eet minder/);
  assert.match(s, /vet visit: 2026-08-15 Oorontsteking links/);
});

await test("summary stays short and empty files send nothing", () => {
  assert.strictEqual(summarise([]), null);
  const many = Array.from({ length: 300 }, (_, i) => rec("diagnosis", "2026-01-01", "Diagnose " + i + " " + "x".repeat(90)));
  assert.ok(summarise(many)!.length <= SUMMARY_MAX);
});

await test("summary: observed signs with date and category, so the AI sees patterns", () => {
  const now = new Date("2026-11-24T12:00:00Z");
  const s = summarise([
    rec("symptom", "2026-11-24", "Niet gegeten", { category: "appetite", details: "Drinkt wel. Stiller." }),
    rec("symptom", "2026-11-03", "Niet gegeten", { category: "appetite", details: "Drinkt wel." }),
    rec("symptom", "2025-06-01", "Oud", { category: "skin" })
  ], now)!;
  assert.match(s, /Observed signs: 2026-11-24 \[appetite\] Niet gegeten \(Drinkt wel\. Stiller\.\); 2026-11-03 \[appetite\] Niet gegeten/);
  assert.ok(!s.includes("Oud"), "older than a year left out");
});

await test("recurring signs: twice or more in half a year, per category, 'other' never", () => {
  const now = new Date("2026-11-24T12:00:00Z");
  const g = recurring([
    rec("symptom", "2026-11-24", "Niet gegeten", { category: "appetite" }),
    rec("symptom", "2026-11-24", "Niet gegeten", { category: "appetite" }),   // same day counts once
    rec("symptom", "2026-11-03", "Eet slecht", { category: "appetite" }),
    rec("symptom", "2026-10-01", "Gebraakt", { category: "vomiting" }),
    rec("symptom", "2026-09-01", "Iets", { category: "other" }),
    rec("symptom", "2026-08-01", "Iets", { category: "other" }),
    rec("symptom", "2025-01-01", "Gebraakt", { category: "vomiting" }),        // too old
    rec("note", "2026-11-01", "Niet gegeten", { category: "appetite" })        // not a sign entry
  ], now);
  assert.deepStrictEqual(g, [{ category: "appetite", dates: ["2026-11-03", "2026-11-24"] }]);
  assert.strictEqual(signCategory("robot"), "other");
  assert.strictEqual(signCategory("stool"), "stool");
});

await test("sign category 'reproductive': kept, labelled in every language, and a pattern like the others", () => {
  assert.strictEqual(signCategory("reproductive"), "reproductive");
  const dir = new URL("../src/i18n/app/", import.meta.url);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const pack = JSON.parse(fs.readFileSync(new URL(f, dir), "utf8"));
    for (const c of SIGN_CATEGORIES) assert.ok(typeof pack["app_sign_" + c] === "string" && pack["app_sign_" + c].trim(), `${f}: app_sign_${c}`);
  }
  const now = new Date("2026-11-24T12:00:00Z");
  assert.deepStrictEqual(recurring([
    rec("symptom", "2026-11-20", "Zwelling bij tepel", { category: "reproductive" }),
    rec("symptom", "2026-10-02", "Zwelling bij tepel", { category: "reproductive" })
  ], now), [{ category: "reproductive", dates: ["2026-10-02", "2026-11-20"] }]);
  assert.match(summarise([rec("symptom", "2026-11-20", "Afscheiding", { category: "reproductive" })], now)!, /\[reproductive\] Afscheiding/);
});

// ---- editing an entry: on Node's SQLite, with every migration of src/lib/db.ts ----
function appDb() {
  const src = fs.readFileSync(new URL("../src/lib/db.ts", import.meta.url), "utf8");
  const list = src.match(/const MIGRATIONS = \[([\s\S]*?)\n\];/);
  assert.ok(list, "MIGRATIONS in src/lib/db.ts");
  const steps = [...list[1].replace(/^\s*\/\/.*$/gm, "").matchAll(/`([^`]*)`/g)].map((m) => m[1]);   // comments may quote `names`
  assert.ok(steps.length >= 7, "all migrations found");
  const sql = new DatabaseSync(":memory:");
  for (const s of steps) sql.exec(s);
  type Bind = string | number | null;
  const db: SqlDb = {
    runAsync: async (s: string, ...p: Bind[]) => ({ changes: Number(sql.prepare(s).run(...p).changes) }),
    getFirstAsync: async <T,>(s: string, ...p: Bind[]) => (sql.prepare(s).get(...p) as T | undefined) ?? null
  };
  sql.exec("INSERT INTO dogs (id, name, weight) VALUES (1, 'Bobby', 30), (2, 'Rex', 12)");
  const add = (dogId: number, kind: string, date: string, title: string, x: { details?: string; value?: number; category?: string; created?: number } = {}) =>
    Number(sql.prepare("INSERT INTO records (dog_id, kind, date, title, details, value, created, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(dogId, kind, date, title, x.details ?? null, x.value ?? null, x.created ?? Date.now(), x.category ?? null).lastInsertRowid);
  const row = (id: number) => sql.prepare("SELECT * FROM records WHERE id = ?").get(id) as any;
  const dog = (id: number) => sql.prepare("SELECT * FROM dogs WHERE id = ?").get(id) as any;
  return { sql, db, add, row, dog };
}
const asRecord = (r: any): DogRecord => ({ id: r.id, dogId: r.dog_id, kind: r.kind, date: r.date, title: r.title, details: r.details, value: r.value, category: r.category });

await test("cleanRecord: trimmed, a value only for a weight, a category only for a sign", () => {
  const base = { dogId: 1, date: "2026-11-14", details: null, value: null };
  assert.deepStrictEqual(cleanRecord({ ...base, kind: "visit", title: "  Oorontsteking  ", details: "  links \n", value: 31, category: "skin" }),
    { ...base, kind: "visit", title: "Oorontsteking", details: "links", value: null, category: null });
  assert.strictEqual(cleanRecord({ ...base, kind: "symptom", title: "Braken", category: "robot" as any })!.category, "other");
  assert.strictEqual(cleanRecord({ ...base, kind: "symptom", title: "Braken", category: "vomiting" })!.category, "vomiting");
  assert.strictEqual(cleanRecord({ ...base, kind: "weight", title: "Weight", value: 31.4 })!.value, 31.4);
  assert.strictEqual(cleanRecord({ ...base, kind: "weight", title: "Weight", value: null }), null, "a weight needs a value");
  assert.strictEqual(cleanRecord({ ...base, kind: "note", title: "   " }), null, "a title is needed");
  assert.strictEqual(cleanRecord({ ...base, kind: "robot" as any, title: "x" }), null, "unknown kind");
  const long = cleanRecord({ ...base, kind: "note", title: "x".repeat(300), details: "y".repeat(5000) })!;
  assert.deepStrictEqual([long.title.length, long.details!.length], [200, 4000]);
  assert.strictEqual(cleanRecord({ ...base, kind: "note", title: "x", details: "   " })!.details, null);
});

await test("editing an entry changes that entry only, of that dog only", async () => {
  const { db, add, row } = appDb();
  const visit = add(1, "visit", "2026-08-15", "Oorontsteking links", { details: "Oor schoongemaakt" });
  const other = add(1, "note", "2026-08-16", "Wandeling");
  const rex = add(2, "visit", "2026-08-15", "Oorontsteking links");
  const before = { other: row(other), rex: row(rex) };
  const edited = cleanRecord({ ...asRecord(row(visit)), date: "2026-08-14", title: "Oorontsteking links, controle over 2 weken", details: "Druppels, 7 dagen 🐾" })!;
  assert.strictEqual(await writeRecord(db, edited), true);
  const after = row(visit);
  assert.deepStrictEqual([after.dog_id, after.kind, after.date, after.title, after.details, after.value, after.category],
    [1, "visit", "2026-08-14", "Oorontsteking links, controle over 2 weken", "Druppels, 7 dagen 🐾", null, null]);
  assert.deepStrictEqual(row(other), before.other);
  assert.deepStrictEqual(row(rex), before.rex);
});

await test("an edit for another dog, or of an entry that is gone, writes nothing", async () => {
  const { db, add, row, sql } = appDb();
  const id = add(1, "note", "2026-08-16", "Wandeling");
  const was = row(id);
  assert.strictEqual(await writeRecord(db, { ...asRecord(was), dogId: 2, title: "Gekaapt" }), false);
  assert.deepStrictEqual(row(id), was);
  assert.strictEqual(await writeRecord(db, { ...asRecord(was), id: id + 99, title: "Spook" }), false);
  assert.strictEqual((sql.prepare("SELECT COUNT(*) AS n FROM records").get() as any).n, 1);
});

await test("a weight edit keeps the profile's weight current, also when it stops being a weight", async () => {
  const { db, add, row, dog } = appDb();
  const old = add(1, "weight", "2026-03-01", "Weight", { value: 29 });
  const latest = add(1, "weight", "2026-09-29", "Weight", { value: 31.4 });
  await writeRecord(db, cleanRecord({ ...asRecord(row(latest)), value: 31.9 })!);
  assert.strictEqual(dog(1).weight, 31.9);
  assert.strictEqual(dog(2).weight, 12, "the other dog keeps its weight");
  // the latest weight becomes a note: its value goes, the profile follows the weight before it
  await writeRecord(db, cleanRecord({ ...asRecord(row(latest)), kind: "note", title: "Gewogen bij de dierenarts" })!);
  assert.strictEqual(row(latest).value, null);
  assert.strictEqual(dog(1).weight, 29);
  // an older weight moved to the newest date is the profile's weight
  await writeRecord(db, cleanRecord({ ...asRecord(row(old)), date: "2026-11-01", value: 30.2 })!);
  assert.strictEqual(dog(1).weight, 30.2);
  assert.strictEqual(dog(1).name, "Bobby");
});

await test("a sign keeps its category, another kind has none, and the chat no longer refines an edited sign", async () => {
  const { db, add, row, sql } = appDb();
  const now = Date.now();
  const id = add(1, "symptom", "2026-11-14", "Braakte na het ontbijt", { category: "vomiting", created: now - 60_000 });
  // the query fileObservation (src/lib/dogfile.ts) uses to find an entry of the same episode
  const episode = () => sql.prepare("SELECT id FROM records WHERE dog_id = ? AND kind = 'symptom' AND category = ? AND created > ? ORDER BY id DESC")
    .get(1, "vomiting", Date.now() - SAME_EPISODE_MS);
  assert.ok(episode(), "filed from the chat a minute ago: the same episode");
  await writeRecord(db, cleanRecord({ ...asRecord(row(id)), details: "Twee keer, geel schuim" })!, now);
  assert.deepStrictEqual([row(id).category, row(id).details], ["vomiting", "Twee keer, geel schuim"]);
  assert.strictEqual(episode(), undefined, "after the owner's edit a new note from the chat is a new entry");
  await writeRecord(db, cleanRecord({ ...asRecord(row(id)), kind: "note" })!, now);
  assert.strictEqual(row(id).category, null);
});

// ---- how the file is shown ----
await test("key facts: every allergy, the latest medication and the latest vet visit", () => {
  const f = keyFacts([
    rec("medication", "2025-01-10", "Old antibiotic"),
    rec("allergy", "2024-11-10", "Kip"),
    rec("visit", "2026-08-15", "Oorontsteking links"),
    rec("medication", "2026-08-15", "Oordruppels"),
    rec("allergy", "2025-06-01", "Vlooien"),
    rec("visit", "2026-02-01", "Controle")
  ]);
  assert.deepStrictEqual(f.allergies.map((r) => r.title), ["Vlooien", "Kip"]);
  assert.strictEqual(f.medication!.title, "Oordruppels");
  assert.strictEqual(f.visit!.title, "Oorontsteking links");
  assert.deepStrictEqual(keyFacts([rec("note", "2026-01-01", "x")]), { allergies: [], medication: null, visit: null });
});

await test("entries by month, newest first, and only the kinds that occur to filter on", () => {
  const a = rec("symptom", "2026-11-14", "Braken"), b = rec("ai", "2026-11-14", "Vraag"), c = rec("weight", "2026-09-29", "Weight", { value: 31.4 }),
    d = rec("behaviour", "2026-09-21", "Blaft"), e = rec("visit", "2026-08-15", "Oor"), f = rec("note", "2025-11-30", "Vorig jaar");
  const g = byMonth([e, c, a, f, d, b]);
  assert.deepStrictEqual(g.map((x) => x.month), ["2026-11", "2026-09", "2026-08", "2025-11"]);
  assert.deepStrictEqual(g[0].records.map((r) => r.title), ["Vraag", "Braken"], "same day: the newer entry first");
  assert.strictEqual(g.reduce((n, x) => n + x.records.length, 0), 6, "no entry lost");
  assert.deepStrictEqual(kindsIn([e, c, a, d, b], RECORD_KINDS.map((k) => k.kind)), ["symptom", "visit", "weight", "behaviour", "ai"]);
});

await test("month headings and day dates in the app language", () => {
  assert.strictEqual(formatMonth("2026-11", "en"), "November 2026");
  assert.strictEqual(formatMonth("2026-11", "nl"), "November 2026", "a heading starts with a capital");
  assert.strictEqual(formatMonth("2026-11", "pl"), "Listopad 2026");
  assert.strictEqual(formatMonth("2026-11", "sr"), "Novembar 2026.", "Serbian in Latin script");
  assert.strictEqual(formatMonth("2026-13", "en"), "2026-13");
  assert.strictEqual(formatDayMonth("2026-11-14", "en"), "14 November");
  assert.strictEqual(formatDayMonth("2026-11-14", "de"), "14. November");
  assert.strictEqual(formatDayMonth("2026-02-30", "en"), "2026-02-30");
});

// Every literal text key used by the dog screens exists (a typo would show the key itself).
await test("the dog screens' texts exist", () => {
  const en = { ...JSON.parse(fs.readFileSync(new URL("../src/i18n/packs/en.json", import.meta.url), "utf8")),
    ...JSON.parse(fs.readFileSync(new URL("../src/i18n/app/en.json", import.meta.url), "utf8")) };
  const files = ["src/app/(tabs)/dogs.tsx", "src/app/dog/[id].tsx", "src/app/dog/edit/[id].tsx", "src/app/dog/file/[id].tsx", "src/app/dog/entry/[id].tsx",
    "src/app/dog/ai/[id].tsx", "src/ui/DogForm.tsx", "src/ui/BreedPicker.tsx", "src/ui/DateField.tsx", "src/lib/dogfile.ts"];
  let n = 0;
  for (const f of files) {
    const src = fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
    for (const m of src.matchAll(/\btf?\("([A-Za-z0-9_]+)"\s*[,)]/g)) { n++; assert.ok(m[1] in en, `${f}: ${m[1]}`); }
    for (const m of src.matchAll(/"(app_[A-Za-z0-9_]*[A-Za-z0-9])"/g)) assert.ok(m[1] in en, `${f}: ${m[1]}`);   // not a prefix such as "app_sign_"
  }
  assert.ok(n > 50, "keys found");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
