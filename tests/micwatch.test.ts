// Run with:  node tests/micwatch.test.ts
// The microphone check of the AI voice conversation: from the connection's statistics,
// is the phone still sending audio?
import assert from "node:assert";
import { levelBars, micSample, micWatch } from "../src/lib/micwatch.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}
const report = (...stats: object[]) => new Map(stats.map((s, i) => ["s" + i, s]));

console.log("microphone check");

test("reads captured audio, sent packets and level; ignores video and incoming audio", () => {
  const s = micSample(report(
    { type: "media-source", kind: "audio", totalSamplesDuration: 3.5, audioLevel: 0.02 },
    { type: "outbound-rtp", kind: "audio", packetsSent: 170 },
    { type: "outbound-rtp", kind: "video", packetsSent: 999 },
    { type: "inbound-rtp", kind: "audio", packetsReceived: 400, audioLevel: 0.9 },
    { type: "candidate-pair", state: "succeeded" }
  ));
  assert.deepStrictEqual(s, { samples: 3.5, packets: 170, level: 0.02 });
});

test("older reports that say mediaType instead of kind", () => {
  assert.deepStrictEqual(micSample(report({ type: "outbound-rtp", mediaType: "audio", packetsSent: 5 })), { packets: 5 });
});

test("no numbers at all: nothing to judge", () => {
  assert.deepStrictEqual(micSample(report({ type: "media-source", kind: "audio" }, { type: "transport" })), {});
});

test("working microphone: growing numbers stay ok, also for a long silence", () => {
  const w = micWatch(4000);
  for (let t = 0; t <= 20000; t += 250) assert.strictEqual(w.check({ samples: t / 1000, packets: t / 20 }, t), "ok");
});

test("only one of the two numbers present and growing: ok", () => {
  const w = micWatch(4000);
  for (let t = 0; t <= 10000; t += 250) assert.strictEqual(w.check({ packets: t / 20 }, t), "ok");
});

test("nothing captured or sent: dead after 4 s, not before", () => {
  const w = micWatch(4000);
  assert.strictEqual(w.check({ samples: 0, packets: 0 }, 0), "ok");
  assert.strictEqual(w.check({ samples: 0, packets: 0 }, 3750), "ok");
  assert.strictEqual(w.check({ samples: 0, packets: 0 }, 4000), "dead");
});

test("stops part-way through the call: dead 4 s after the last growth", () => {
  const w = micWatch(4000);
  for (let t = 0; t <= 5000; t += 250) w.check({ samples: t / 1000, packets: t / 20 }, t);
  assert.strictEqual(w.check({ samples: 5, packets: 250 }, 8750), "ok");
  assert.strictEqual(w.check({ samples: 5, packets: 250 }, 9000), "dead");
});

test("missing statistics never count as a dead microphone", () => {
  const w = micWatch(4000);
  for (let t = 0; t <= 10000; t += 250) assert.strictEqual(w.check({}, t), "ok");
  assert.strictEqual(w.check({ level: 0 }, 11000), "ok");
});

test("reset after restarting the recording: a fresh 4 s", () => {
  const w = micWatch(4000);
  w.check({ samples: 1, packets: 50 }, 0);
  assert.strictEqual(w.check({ samples: 1, packets: 50 }, 4000), "dead");
  w.reset();
  assert.strictEqual(w.check({ samples: 1, packets: 50 }, 4250), "ok");
  assert.strictEqual(w.check({ samples: 1, packets: 50 }, 8000), "ok");
  assert.strictEqual(w.check({ samples: 1, packets: 50 }, 8250), "dead");
  w.reset();
  w.check({ samples: 1, packets: 50 }, 9000);
  assert.strictEqual(w.check({ samples: 1.25, packets: 62 }, 9250), "ok");
  assert.strictEqual(w.check({ samples: 1.5, packets: 75 }, 14000), "ok");
});

test("level bars: silence none, speech some, loud all", () => {
  assert.strictEqual(levelBars(undefined), 0);
  assert.strictEqual(levelBars(0), 0);
  assert.strictEqual(levelBars(0.001), 0);    // -60 dB
  assert.strictEqual(levelBars(0.01), 1);     // -40 dB
  assert.strictEqual(levelBars(0.03), 2);     // -30 dB
  assert.strictEqual(levelBars(0.1), 4);      // -20 dB
  assert.strictEqual(levelBars(0.5), 5);      // -6 dB
  assert.strictEqual(levelBars(1), 5);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
