// Run with:  node tests/findlist.test.ts
// Find's list with "Independents only" and "Open now". What matters most: "Open now"
// never hides a place whose hours are unknown, and never hides the only open vet
// because it belongs to a chain.
import assert from "node:assert";
import { findList, openness, type FindOptions, type Listable, type Row } from "../src/lib/findlist.ts";
import type { Category } from "../src/core/classify";
import type { Status } from "../src/lib/hourstext.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}

type P = Listable & { s: Status["kind"] };
const mk = (id: string, cat: Category, s: Status["kind"], chain: string | null = null, emergency: P["emergency"] = null): P => ({ id, cat, s, chain, emergency });
const STATUS: Record<Status["kind"], Status> = {
  always: { kind: "always" }, open: { kind: "open", closes: null, soon: false },
  closed: { kind: "closed", opens: null }, unknown: { kind: "unknown" }
};
const ALL = { vet: true, hospital: true, grooming: true, shop: true, boarding: true, training: true, play: true, shelter: true };
const only = (...cs: Category[]) => Object.fromEntries(Object.keys(ALL).map((c) => [c, cs.includes(c as Category)])) as Record<Category, boolean>;
const opts = (o: Partial<FindOptions<P>> = {}): FindOptions<P> => ({ cats: ALL, independentOnly: true, openOnly: true, canWiden: true, status: (p) => STATUS[p.s], ...o });
// The rows as short strings: place ids, "#heading", "!note", "+widen", "closed:n", "emergency".
const view = (rows: Row<P>[]) => rows.map((r) =>
  r.kind === "place" ? r.p.id : r.kind === "heading" ? "#" + r.text : r.kind === "note" ? "!" + r.text :
  r.kind === "widen" ? "+widen" : r.kind === "showClosed" ? "closed:" + r.n : "emergency");
const ids = (ps: P[]) => ps.map((p) => p.id);

console.log("find list");

test("openness: closed only when the hours say so; 24/7 emergency service counts as open", () => {
  assert.strictEqual(openness(mk("a", "vet", "open"), STATUS.open), "open");
  assert.strictEqual(openness(mk("a", "vet", "always"), STATUS.always), "open");
  assert.strictEqual(openness(mk("a", "vet", "closed"), STATUS.closed), "closed");
  assert.strictEqual(openness(mk("a", "vet", "unknown"), STATUS.unknown), "unknown");
  assert.strictEqual(openness(mk("a", "vet", "closed", null, "24/7"), STATUS.closed), "open");
  assert.strictEqual(openness(mk("a", "vet", "closed", null, "on_call"), STATUS.closed), "closed");
  assert.strictEqual(openness(mk("a", "vet", "unknown", null, "on_call"), STATUS.unknown), "unknown");
});

test("without Open now: as before (independents, chains only when wanted or the only ones)", () => {
  const places = [mk("v1", "vet", "closed"), mk("c1", "vet", "open", "AniCura"), mk("s1", "shop", "unknown")];
  let r = findList(places, opts({ openOnly: false }));
  assert.deepStrictEqual(view(r.rows), ["v1", "s1"]);
  assert.deepStrictEqual(ids(r.shown), ["v1", "s1"]);
  assert.deepStrictEqual([r.open, r.unknown, r.closed], [0, 0, 0]);
  r = findList(places, opts({ openOnly: false, independentOnly: false }));
  assert.deepStrictEqual(view(r.rows), ["v1", "s1", "#chains", "c1"]);
  r = findList([mk("c1", "vet", "open", "AniCura")], opts({ openOnly: false }));
  assert.deepStrictEqual(view(r.rows), ["!chainOnly", "+widen", "c1"]);
  r = findList([mk("c1", "vet", "open", "AniCura")], opts({ openOnly: false, canWiden: false }));
  assert.deepStrictEqual(view(r.rows), ["!chainOnly", "c1"]);
  // the status is not even asked for
  r = findList(places, opts({ openOnly: false, status: () => { throw new Error("asked"); } }));
  assert.strictEqual(r.shown.length, 2);
});

test("Open now: open first, then unknown hours, nearest first in each; closed hidden and counted", () => {
  const places = [mk("v1", "vet", "unknown"), mk("g1", "grooming", "closed"), mk("p1", "play", "unknown"), mk("s1", "shop", "open"), mk("v2", "vet", "always"), mk("s2", "shop", "closed")];
  const r = findList(places, opts());
  assert.deepStrictEqual(view(r.rows), ["#openNow", "s1", "v2", "#hoursUnknown", "v1", "p1", "closed:2"]);
  assert.deepStrictEqual(ids(r.shown), ["s1", "v2", "v1", "p1"]);
  assert.deepStrictEqual([r.open, r.unknown, r.closed], [2, 2, 2]);
});

test("Open now never hides a place with unknown hours (half the vets, nearly every park)", () => {
  const places = [mk("v1", "vet", "unknown"), mk("v2", "vet", "unknown"), mk("p1", "play", "unknown"), mk("sh", "shelter", "unknown")];
  const r = findList(places, opts());
  assert.deepStrictEqual(view(r.rows), ["#hoursUnknown", "v1", "v2", "p1", "sh"]);
  assert.deepStrictEqual([r.open, r.unknown, r.closed], [0, 4, 0]);
});

test("only open places: no headings", () => {
  const r = findList([mk("s1", "shop", "open"), mk("v1", "vet", "open")], opts());
  assert.deepStrictEqual(view(r.rows), ["s1", "v1"]);
});

test("only a chain vet is open: shown, even when an independent shop is open", () => {
  const places = [mk("v1", "vet", "closed"), mk("s1", "shop", "open"), mk("c1", "vet", "open", "AniCura"), mk("c2", "shop", "open", "Pets Place"), mk("v2", "vet", "unknown")];
  const r = findList(places, opts());
  // c2 (a chain shop) stays hidden: an independent shop is open
  assert.deepStrictEqual(view(r.rows), ["#openNow", "s1", "!openChains", "c1", "#hoursUnknown", "v2", "closed:1"]);
  assert.deepStrictEqual(ids(r.shown), ["s1", "c1", "v2"]);
  assert.strictEqual(r.open, 2);
});

test("vets only, no independent open: the open chain clinics, a wider search, then unknown hours", () => {
  const places = [mk("v1", "vet", "unknown"), mk("c1", "vet", "open", "AniCura"), mk("c2", "vet", "unknown", "IVC Evidensia"), mk("v2", "vet", "closed")];
  let r = findList(places, opts({ cats: only("vet") }));
  // The chain with unknown hours stays hidden: an independent one with unknown hours is listed
  assert.deepStrictEqual(view(r.rows), ["#openNow", "!openChains", "+widen", "c1", "#hoursUnknown", "v1", "closed:1"]);
  r = findList(places, opts({ cats: only("vet"), canWiden: false }));
  assert.deepStrictEqual(view(r.rows), ["#openNow", "!openChains", "c1", "#hoursUnknown", "v1", "closed:1"]);
});

test("an independent vet open: chain vets stay hidden with Independents only", () => {
  const places = [mk("c1", "vet", "open", "AniCura"), mk("v1", "vet", "open"), mk("c2", "vet", "unknown", "AniCura")];
  const r = findList(places, opts());
  assert.deepStrictEqual(view(r.rows), ["v1"]);
  assert.strictEqual(r.closed, 0);
});

test("Independents only off: chains after the independents in each group, no note", () => {
  const places = [mk("c1", "vet", "open", "AniCura"), mk("v1", "vet", "open"), mk("c2", "shop", "unknown", "Pets Place"), mk("s1", "shop", "unknown"), mk("c3", "vet", "closed", "AniCura")];
  const r = findList(places, opts({ independentOnly: false }));
  assert.deepStrictEqual(view(r.rows), ["#openNow", "v1", "c1", "#hoursUnknown", "s1", "c2", "closed:1"]);
  assert.deepStrictEqual([r.open, r.unknown, r.closed], [2, 2, 1]);
});

test("only chains with unknown hours nearby: shown as without Open now", () => {
  const places = [mk("c1", "shop", "unknown", "Pets Place"), mk("c2", "shop", "closed", "Pets Place")];
  const r = findList(places, opts());
  assert.deepStrictEqual(view(r.rows), ["#hoursUnknown", "!chainOnly", "+widen", "c1", "closed:1"]);
});

test("nothing open: say so, a wider search, show closed ones, and Emergency for vets", () => {
  const places = [mk("v1", "vet", "closed"), mk("v2", "vet", "closed"), mk("g1", "grooming", "closed")];
  let r = findList(places, opts({ cats: only("vet") }));
  assert.deepStrictEqual(view(r.rows), ["!noneOpen", "+widen", "closed:2", "emergency"]);
  assert.deepStrictEqual(r.shown, []);
  r = findList(places, opts({ cats: only("grooming"), canWiden: false }));
  assert.deepStrictEqual(view(r.rows), ["!noneOpen", "closed:1"]);
  r = findList(places, opts({ cats: only("hospital", "grooming") }));
  assert.deepStrictEqual(view(r.rows), ["!noneOpen", "+widen", "closed:1", "emergency"]);
});

test("nothing at all in the chosen categories: the plain empty list", () => {
  const r = findList([mk("v1", "vet", "open")], opts({ cats: only("shop") }));
  assert.deepStrictEqual(r.rows, []);
  assert.deepStrictEqual([r.open, r.unknown, r.closed], [0, 0, 0]);
  assert.deepStrictEqual(findList([], opts()).rows, []);
});

test("closed places counted are the ones the list would show without Open now", () => {
  // A closed chain vet is not counted with Independents only: turning Open now off wouldn't show it.
  const places = [mk("v1", "vet", "closed"), mk("c1", "vet", "closed", "AniCura"), mk("s1", "shop", "open")];
  assert.strictEqual(findList(places, opts()).closed, 1);
  assert.strictEqual(findList(places, opts({ independentOnly: false })).closed, 2);
});

test("a clinic with its own 24/7 emergency service is listed as open", () => {
  const places = [mk("v1", "vet", "closed", null, "24/7"), mk("v2", "vet", "closed", null, "on_call")];
  const r = findList(places, opts());
  assert.deepStrictEqual(view(r.rows), ["v1", "closed:1"]);
});

test("the status is read once per place", () => {
  const asked: string[] = [];
  findList([mk("v1", "vet", "open"), mk("s1", "shop", "unknown"), mk("x", "training", "closed")], opts({ cats: only("vet", "shop"), status: (p) => { asked.push(p.id); return STATUS[p.s]; } }));
  assert.deepStrictEqual(asked, ["v1", "s1"]);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
