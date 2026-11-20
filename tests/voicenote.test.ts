// Run with:  node tests/voicenote.test.ts
// The note for the dog's file at the end of an AI voice conversation: the model's
// JSON answer, checked on the phone (it never passes our server).
import assert from "node:assert";
import { parseVoiceNote } from "../src/lib/voicenote.ts";
import { signCategory } from "../src/lib/dogsummary.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}
const TODAY = "2026-11-20";
const parse = (answer: unknown) => parseVoiceNote(answer, TODAY, signCategory);
const note = (o: Record<string, unknown>, urgency: unknown = "vet_today") =>
  JSON.stringify({ observation: { date: "2026-11-19", category: "vomiting", title: "Braken", details: "Sinds gisteravond drie keer, drinkt normaal", ...o }, urgency });

console.log("voice note");

test("valid: the note and the urgency", () => {
  assert.deepStrictEqual(parse(note({})), {
    observation: { date: "2026-11-19", category: "vomiting", title: "Braken", details: "Sinds gisteravond drie keer, drinkt normaal" },
    urgency: "vet_today"
  });
});

test("valid, also in a code block or after a sentence", () => {
  assert.strictEqual(parse("```json\n" + note({}) + "\n```")?.observation.title, "Braken");
  assert.strictEqual(parse("Here is the note: " + note({}))?.observation.title, "Braken");
});

test("null: nothing to note", () => {
  assert.strictEqual(parse('{"observation": null, "urgency": "monitor"}'), null);
  assert.strictEqual(parse("null"), null);
  assert.strictEqual(parse(""), null);
  assert.strictEqual(parse(null), null);
  assert.strictEqual(parse(undefined), null);
});

test("invalid: not JSON, cut off, or without a title", () => {
  assert.strictEqual(parse("Bobbie vomited twice."), null);
  assert.strictEqual(parse(note({}).slice(0, 60)), null);           // the answer stopped half-way (time-out, token limit)
  assert.strictEqual(parse('["Braken", "2026-11-19"]'), null);
  assert.strictEqual(parse("{observation: Braken}"), null);
  assert.strictEqual(parse('{"observation": "vomiting"}'), null);
  assert.strictEqual(parse(note({ title: "   " })), null);
  assert.strictEqual(parse(note({ title: 42 })), null);
});

test("wrong date: one that doesn't exist, in the future, over a year back or not a date becomes today", () => {
  for (const date of ["2026-02-30", "2026-13-01", "2026-11-21", "2030-01-01", "2025-11-19", "2024-06-01", "yesterday", "19-11-2026", 20261119, null]) {
    assert.strictEqual(parse(note({ date }))?.observation.date, TODAY, String(date));
  }
  assert.strictEqual(parse(note({ date: undefined }))?.observation.date, TODAY);
  assert.strictEqual(parse(note({ date: TODAY }))?.observation.date, TODAY);
  assert.strictEqual(parse(note({ date: "2025-11-20" }))?.observation.date, "2025-11-20");   // exactly a year back is kept
});

test("an unknown category becomes other, an unknown urgency unclear", () => {
  const n = parse(note({ category: "stomach" }, "urgent"));
  assert.strictEqual(n?.observation.category, "other");
  assert.strictEqual(n?.urgency, "unclear");
  assert.strictEqual(parse(JSON.stringify({ observation: { date: TODAY, category: "mouth", title: "Bad breath", details: "" } }))?.urgency, "unclear");
});

test("a bare observation (without the wrapper) is accepted", () => {
  const n = parse(JSON.stringify({ date: "2026-11-18", category: "mobility", title: "Limping", details: "Left hind leg", urgency: "vet_soon" }));
  assert.deepStrictEqual(n, { observation: { date: "2026-11-18", category: "mobility", title: "Limping", details: "Left hind leg" }, urgency: "vet_soon" });
});

test("text is tidied and capped like the chat's (title 80, details 300)", () => {
  const n = parse(note({ title: "  Not\n eating " + "x".repeat(100), details: "a\tb  c\u0000d" + "y".repeat(400) }));
  assert.ok(n!.observation.title.startsWith("Not eating x") && n!.observation.title.length === 80);
  assert.ok(n!.observation.details.startsWith("a b c d") && n!.observation.details.length === 300);
  assert.strictEqual(parse(note({ details: 7 }))?.observation.details, "");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
