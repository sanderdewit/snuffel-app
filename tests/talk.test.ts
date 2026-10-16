// Run with:  node tests/talk.test.ts   (Node 23.6+ runs TypeScript directly)
import assert from "node:assert";
import { isStopPhrase } from "../src/lib/talk.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}

const NL = "stop,stoppen,bedankt,dank je,dank je wel,klaar,dat was het,tot ziens";
const EN = "stop,thanks,thank you,that's all,goodbye,done";

console.log("conversation mode");
test("a stop phrase, alone or with one extra word, ends the conversation", () => {
  for (const s of ["Stop", "stop.", "Bedankt!", "oké bedankt", "Dank je wel", "Dat was het", "dat was het hoor"]) assert.ok(isStopPhrase(s, NL), s);
  for (const s of ["Thanks", "Thank you!", "That's all", "ok thanks"]) assert.ok(isStopPhrase(s, EN), s);
});
test("a real question that contains a stop word goes on", () => {
  for (const s of ["Hoe stop ik het blaffen?", "stop met trekken aan de lijn", "Ze is klaar met eten maar blijft hijgen"]) assert.ok(!isStopPhrase(s, NL), s);
  assert.ok(!isStopPhrase("How do I stop him pulling?", EN));
  assert.ok(!isStopPhrase("", NL));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
