// Run with:  node tests/dogfile.test.ts
// Password-protected export round trip, and the summary sent to the AI.
import assert from "node:assert";
import { webcrypto } from "node:crypto";
import { gcm } from "@noble/ciphers/aes.js";
import { utf8ToBytes } from "@noble/ciphers/utils.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { b64, BadSealError, imageType, PasswordTooShortError, seal, SCRYPT, unseal, WrongPasswordError } from "../src/lib/seal.ts";
import { summarise, SUMMARY_MAX, type DogRecord } from "../src/lib/dogsummary.ts";

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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
