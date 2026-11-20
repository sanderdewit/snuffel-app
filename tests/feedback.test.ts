// Run with:  node tests/feedback.test.ts   (Node 23.6+ runs TypeScript directly)
// The report a thumbs down may send: names, e-mail addresses and phone numbers
// replaced, only the allowed fields, within the server's limits.
import assert from "node:assert";
import { buildReport, scrub, LIMITS, type ReportInput } from "../src/lib/feedbackReport.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}

const input = (over: Partial<ReportInput> = {}): ReportInput => Object.assign({
  turns: [
    { role: "user", content: "Bobbie eet sinds gisteren niet." },
    { role: "assistant", content: "Houd Bobbie goed in de gaten.", urgency: "monitor" }
  ],
  dog: { breed: "Labrador Retriever", ageMonths: 26, weightKg: 30.04, sex: "female", neutered: true },
  names: ["Bobbie"], comment: "", lang: "nl", appVersion: "1.0.3"
}, over) as ReportInput;

console.log("feedback report");

test("the dog's name becomes [name] everywhere, as a whole word, any case", () => {
  assert.strictEqual(scrub("Bobbie, BOBBIE en bobbie's bak", ["Bobbie"]), "[name], [name] en [name]'s bak");
  assert.strictEqual(scrub("Max eats maximum twice", ["Max"]), "[name] eats maximum twice");
  assert.strictEqual(scrub("Žofka a žofka", ["Žofka"]), "[name] a [name]");
  assert.strictEqual(scrub("Lady Di and Lady", ["Lady Di"]), "[name] and [name]");
  assert.strictEqual(scrub("Mr. (Bean) bit", ["Mr. (Bean)"]), "[name] bit");   // regex characters in a name
  assert.strictEqual(scrub("no names", ["", "  "]), "no names");
  assert.strictEqual(scrub("Name mailt a@b.nl", ["Name", "Email"]), "[name] mailt [email]");   // a name can't eat a token
});

test("e-mail addresses and phone or chip numbers are replaced; dates, weights and times stay", () => {
  assert.strictEqual(scrub("mail me: jan.de.vries@example.nl.", []), "mail me: [email].");
  assert.strictEqual(scrub("bel 06-12345678 of +31 6 1234 5678", []), "bel [number] of [number]");
  assert.strictEqual(scrub("chip 528140000123456", []), "chip [number]");
  assert.strictEqual(scrub("sinds 2026-11-20, 12.5 kg, om 14:30, 3 keer", []), "sinds 2026-11-20, 12.5 kg, om 14:30, 3 keer");
  assert.strictEqual(scrub("op 20-11-2026 en 2026-11-20 12", []), "op 20-11-2026 en 2026-11-20 12");
});

test("a report: the conversation up to the rated answer, the dog's details, no name", () => {
  const r = buildReport(input({ comment: "Te laag\ningeschat, Bobbie was echt ziek" }))!;
  assert.deepStrictEqual(Object.keys(r).sort(), ["appVersion", "comment", "dog", "lang", "messages"]);
  assert.deepStrictEqual(r.messages, [
    { role: "user", content: "[name] eet sinds gisteren niet." },
    { role: "assistant", content: "Houd [name] goed in de gaten.", urgency: "monitor" }
  ]);
  assert.deepStrictEqual(r.dog, { breed: "Labrador Retriever", ageMonths: 26, weightKg: 30, sex: "female", neutered: true });
  assert.strictEqual(r.comment, "Te laag ingeschat, [name] was echt ziek");
  assert.ok(!JSON.stringify(r).includes("Bobbie"));
});

test("unknown dog details and an empty comment are left out", () => {
  const r = buildReport(input({ dog: { breed: " ", ageMonths: null, weightKg: 900, sex: null, neutered: null } }))!;
  assert.ok(!("dog" in r) && !("comment" in r));
  assert.ok(!("dog" in buildReport(input({ dog: null }))!));
  assert.strictEqual(buildReport(input({ dog: { neutered: false } }))!.dog!.neutered, false);
});

test("only an answer can be reported; urgency only on answers, known values only", () => {
  assert.strictEqual(buildReport(input({ turns: [{ role: "user", content: "hoi" }] })), null);
  assert.strictEqual(buildReport(input({ turns: [] })), null);
  const r = buildReport(input({ turns: [
    { role: "user", content: "a", urgency: "emergency" },
    { role: "assistant", content: "b", urgency: "panic" }
  ] }))!;
  assert.deepStrictEqual(r.messages, [{ role: "user", content: "a" }, { role: "assistant", content: "b" }]);
});

test("within the server's limits: the newest turns, the rated answer last", () => {
  const turns = Array.from({ length: 60 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: String(i) + " " + "x".repeat(5000) }));
  const r = buildReport(input({ turns }))!;
  assert.ok(r.messages.length <= LIMITS.messages);
  assert.ok(r.messages.every((m) => m.content.length <= LIMITS.messageChars));
  assert.ok(r.messages.reduce((n, m) => n + m.content.length, 0) <= LIMITS.totalChars);
  assert.ok(r.messages[r.messages.length - 1].content.startsWith("59 "));
  assert.strictEqual(buildReport(input({ comment: "x".repeat(500) }))!.comment!.length, LIMITS.comment);
  assert.strictEqual(buildReport(input({ appVersion: "dev" }))!.appVersion, "0.0.0");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
