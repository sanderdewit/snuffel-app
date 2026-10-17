// Run with:  node tests/dates.test.ts   (Node 23.6+ runs TypeScript directly)
import assert from "node:assert";
import { addMonths, ageMonths, formatDate, validDate } from "../src/lib/dates.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}

console.log("dates");
test("valid dates only", () => {
  assert.ok(validDate("2024-02-29"));
  assert.ok(!validDate("2023-02-29"));
  assert.ok(!validDate("2024-13-01"));
  assert.ok(!validDate("1-2-2024"));
});
test("next reminder: same day, clamped to month end", () => {
  assert.strictEqual(addMonths("2026-01-31", 1), "2026-02-28");
  assert.strictEqual(addMonths("2028-01-31", 1), "2028-02-29");
  assert.strictEqual(addMonths("2026-10-10", 3), "2027-01-10");
  assert.strictEqual(addMonths("2026-03-31", 12), "2027-03-31");
});
test("age in whole months", () => {
  const now = new Date("2026-10-10T12:00:00");
  assert.strictEqual(ageMonths("2026-10-10", now), 0);
  assert.strictEqual(ageMonths("2026-04-11", now), 5);
  assert.strictEqual(ageMonths("2014-10-10", now), 144);
  assert.strictEqual(ageMonths("2027-01-01", now), null);   // future
  assert.strictEqual(ageMonths(null, now), null);
});

test("dates are shown the local way, invalid input as given", () => {
  assert.strictEqual(formatDate("2021-04-30", "nl"), "30 april 2021");
  assert.strictEqual(formatDate("2021-04-30", "en"), "30 April 2021");
  assert.strictEqual(formatDate("2021-04-30", "de"), "30. April 2021");
  assert.strictEqual(formatDate("2021-02-30", "nl"), "2021-02-30");
  assert.strictEqual(formatDate("", "nl"), "");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
