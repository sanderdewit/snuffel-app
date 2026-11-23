// Run with:  node tests/freshness.test.ts
// When the app looks for new place data (src/lib/freshness.ts). What matters most: a
// phone that keeps the app in memory for days still gets a new data version, and a
// search never waits on a slow network when the phone has a stored copy.
import assert from "node:assert";
import { versionCheck, CHECK_MS, RETRY_MS, type CheckDeps, type Fetched, type Stored } from "../src/lib/freshness.ts";

let passed = 0, failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}

interface M { version: string }
type Answer = Fetched<M> | "offline" | Promise<Fetched<M>>;

/** A fake phone: storage, a clock, and a server that answers from `answers` in turn. */
function phone(stored: Stored<M> | null, answers: Answer[], slow = false) {
  const s = { stored, now: 1_000_000, asked: [] as (string | null)[], saved: 0, news: [] as string[], online: [] as boolean[] };
  const deps: CheckDeps<M> = {
    load: async () => s.stored,
    save: async (x) => { s.stored = x; s.saved++; },
    fetch: async (etag) => {
      s.asked.push(etag);
      const a = answers.shift();
      if (!a) throw new Error("no answer left");
      if (a === "offline") throw new Error("offline");
      return a;
    },
    now: () => s.now,
    onNew: (v, prev) => { s.news.push((prev ? prev.version : "-") + ">" + v.version); },
    onOnline: (o) => { s.online.push(o); },
    // slow: the short wait for a check is over at once; else the network always answers first
    wait: slow ? async () => undefined : () => new Promise<void>(() => undefined)
  };
  return { s, check: versionCheck(deps) };
}
const ok = (version: string, etag: string): Fetched<M> => ({ status: 200, etag, value: { version } });
const NOT_MODIFIED: Fetched<M> = { status: 304, etag: null };
const tick = () => new Promise((r) => setTimeout(r, 0));

await test("first use, nothing stored: waits for the network and stores the manifest with its ETag", async () => {
  const { s, check } = phone(null, [ok("11-23", "e1")]);
  assert.strictEqual((await check.get())?.version, "11-23");
  assert.deepStrictEqual(s.asked, [null]);
  assert.strictEqual(s.stored?.etag, "e1");
});

await test("within 15 minutes: no second request", async () => {
  const { s, check } = phone(null, [ok("11-23", "e1")]);
  await check.get();
  s.now += CHECK_MS - 1;
  assert.strictEqual((await check.get())?.version, "11-23");
  assert.strictEqual(s.asked.length, 1);
});

await test("kept in memory for days: after 15 minutes the next search finds the new version (the old app never looked again)", async () => {
  const { s, check } = phone(null, [ok("11-22", "e1"), NOT_MODIFIED, ok("11-23", "e2")]);
  assert.strictEqual((await check.get())?.version, "11-22");
  s.now += CHECK_MS;
  assert.strictEqual((await check.get())?.version, "11-22");   // 304: unchanged
  assert.deepStrictEqual(s.asked, [null, "e1"]);
  assert.strictEqual(s.saved, 1);
  s.now += 3 * 24 * 3600 * 1000;
  assert.strictEqual((await check.get())?.version, "11-23");
  assert.deepStrictEqual(s.news, ["->11-22", "11-22>11-23"]);
  assert.strictEqual(s.stored?.v.version, "11-23");
});

await test("app start with a stored copy: asks with its ETag; an older stored copy without one asks without", async () => {
  const a = phone({ at: 0, v: { version: "11-22" }, etag: "e1" }, [NOT_MODIFIED]);
  assert.strictEqual((await a.check.get())?.version, "11-22");
  assert.deepStrictEqual(a.s.asked, ["e1"]);
  const b = phone({ at: 0, v: { version: "11-22" } }, [ok("11-23", "e2")]);
  assert.strictEqual((await b.check.get())?.version, "11-23");
  assert.deepStrictEqual(b.s.asked, [null]);
});

await test("slow network with a stored copy: the search gets the stored copy at once, the next search the new one", async () => {
  let answer!: (f: Fetched<M>) => void;
  const slow = new Promise<Fetched<M>>((r) => { answer = r; });
  const { s, check } = phone({ at: 0, v: { version: "11-22" }, etag: "e1" }, [slow], true);
  assert.strictEqual((await check.get())?.version, "11-22");
  answer(ok("11-23", "e2"));
  await tick();
  assert.strictEqual((await check.get())?.version, "11-23");
  assert.strictEqual(s.asked.length, 1);
});

await test("offline with a stored copy: the stored copy, marked offline, and another try after a minute (not before)", async () => {
  const { s, check } = phone({ at: 0, v: { version: "11-22" }, etag: "e1" }, ["offline", ok("11-23", "e2")]);
  assert.strictEqual((await check.get())?.version, "11-22");
  assert.deepStrictEqual(s.online, [false]);
  s.now += RETRY_MS - 1;
  await check.get();
  assert.strictEqual(s.asked.length, 1);
  s.now += 1;
  assert.strictEqual((await check.get())?.version, "11-23");
  assert.deepStrictEqual(s.online, [false, true]);
});

await test("offline and nothing stored: no manifest, and the next search tries again", async () => {
  const { s, check } = phone(null, ["offline", ok("11-23", "e1")]);
  assert.strictEqual(await check.get(), null);
  assert.strictEqual((await check.get())?.version, "11-23");
  assert.strictEqual(s.asked.length, 2);
});

await test("a server error is not a new manifest: the stored copy stays", async () => {
  const { s, check } = phone({ at: 0, v: { version: "11-22" }, etag: "e1" }, [{ status: 500, etag: null }]);
  assert.strictEqual((await check.get())?.version, "11-22");
  assert.strictEqual(s.saved, 0);
  assert.deepStrictEqual(s.online, [false]);
});

await test("back to the front: a check starts only when one is due, and the search after it needs no request", async () => {
  const { s, check } = phone(null, [ok("11-22", "e1"), ok("11-23", "e2")]);
  await check.get();
  check.refreshIfDue();
  assert.strictEqual(s.asked.length, 1);
  s.now += CHECK_MS;
  check.refreshIfDue();
  await tick(); await tick();
  assert.strictEqual(s.asked.length, 2);
  assert.strictEqual((await check.get())?.version, "11-23");
  assert.strictEqual(s.asked.length, 2);
});

await test("two searches at once share one request", async () => {
  const { s, check } = phone(null, [ok("11-23", "e1")]);
  const [a, b] = await Promise.all([check.get(), check.get()]);
  assert.strictEqual(a?.version, "11-23");
  assert.strictEqual(b?.version, "11-23");
  assert.strictEqual(s.asked.length, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
