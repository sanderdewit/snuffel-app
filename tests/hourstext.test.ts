// Run with:  node tests/hourstext.test.ts   (Node 23.6+ runs TypeScript directly)
// The opening-hours texts against the real hours.js. The rule that matters most:
// a place is never called "closed" unless hours.js is sure (Emergency hides closed vets).
import assert from "node:assert";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  capitalize, dayNames, hhmm, hoursStatus, publicHolidays, rangeText, reopensAfter, reopensText,
  statusText, weekRows, type Clock, type HoursEngine, type Status
} from "../src/lib/hourstext.ts";

const require = createRequire(import.meta.url);
const hours: HoursEngine = require("../src/core/hours.js");

// English as the app shows it: the shared pack plus the app's own texts.
const en: Record<string, string> = {
  ...JSON.parse(fs.readFileSync(new URL("../src/i18n/packs/en.json", import.meta.url), "utf8")),
  ...JSON.parse(fs.readFileSync(new URL("../src/i18n/app/en.json", import.meta.url), "utf8"))
};
const tf = (key: string, vars: Record<string, string | number> = {}) => {
  assert.ok(typeof en[key] === "string", "missing English text " + key);
  return en[key].replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
};
const DAYS = dayNames("en");
const SU = 0, MO = 1, TU = 2, WE = 3, SA = 6;
const at = (day: number, h: number, m = 0): Clock => ({ day, minutes: h * 60 + m });
const status = (str: string | null, now: Clock | Date, tz?: string) => hoursStatus(hours, str, tz, now);
const line = (str: string | null, now: Clock | Date, tz?: string) => statusText(status(str, now, tz), tf, DAYS);
const then = (str: string, now: Clock) => { const r = reopensAfter(hours, str, undefined, status(str, now)); return r && reopensText(r, tf, DAYS); };

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}

console.log("hourstext");

const VET = "Mo-Fr 08:00-18:00; Sa 09:00-12:00; PH off";

test("clock times", () => {
  assert.strictEqual(hhmm(0), "00:00");
  assert.strictEqual(hhmm(9 * 60 + 5), "09:05");
  assert.strictEqual(hhmm(26 * 60), "02:00");
  assert.strictEqual(rangeText([480, 1080]), "08:00 – 18:00");
  assert.strictEqual(rangeText([1080, 480]), "18:00 – 08:00");   // overnight
  assert.strictEqual(rangeText([1200, 1560]), "20:00 – 02:00");  // 20:00-26:00
  assert.strictEqual(rangeText([960, 1440]), "16:00 – 24:00");
});

test("open now: closes at, and when it opens again", () => {
  assert.strictEqual(line(VET, at(SA, 10)), "Open now · closes at 12:00");
  assert.strictEqual(then(VET, at(SA, 10)), "Then closed until Monday at 08:00");
  assert.strictEqual(line(VET, at(MO, 8)), "Open now · closes at 18:00");
  assert.strictEqual(then(VET, at(MO, 8)), "Then closed until tomorrow at 08:00");
  assert.strictEqual(then(VET, at(TU, 17, 59)), "Then closed until tomorrow at 08:00");
});

test("closed: opens today, tomorrow or on a weekday", () => {
  assert.strictEqual(line(VET, at(MO, 7, 30)), "Closed · opens at 08:00");
  assert.strictEqual(line(VET, at(MO, 18)), "Closed · opens tomorrow at 08:00");   // the end is exclusive
  assert.strictEqual(line(VET, at(SA, 12)), "Closed · opens Monday at 08:00");
  assert.strictEqual(line(VET, at(SU, 23, 59)), "Closed · opens tomorrow at 08:00");
  assert.strictEqual(line("Tu 09:00-12:00", at(TU, 13)), "Closed · opens Tuesday at 09:00");   // a week ahead
});

test("closing soon (within the hour)", () => {
  const s = status(VET, at(SA, 11, 1)) as Extract<Status, { kind: "open" }>;
  assert.strictEqual(s.kind, "open");
  assert.strictEqual(s.soon, true);
  assert.strictEqual((status(VET, at(SA, 10, 59)) as Extract<Status, { kind: "open" }>).soon, false);
});

test("lunch break: closed until later today", () => {
  const s = "Mo-Fr 08:00-12:00,13:30-18:00";
  assert.strictEqual(line(s, at(WE, 11)), "Open now · closes at 12:00");
  assert.strictEqual(then(s, at(WE, 11)), "Then closed until 13:30");
  assert.strictEqual(line(s, at(WE, 12, 15)), "Closed · opens at 13:30");
});

test("overnight and midnight", () => {
  const night = "Mo-Su 18:00-08:00";
  assert.strictEqual(line(night, at(MO, 23)), "Open now · closes tomorrow at 08:00");
  assert.strictEqual(line(night, at(TU, 7)), "Open now · closes at 08:00");   // yesterday's range spills over
  assert.strictEqual(line(night, at(TU, 12)), "Closed · opens at 18:00");
  assert.strictEqual(line("Mo-Fr 16:00-24:00", at(MO, 20)), "Open now · closes at 24:00");
  assert.strictEqual(line("Mo-Fr 16:00-24:00", at(MO, 23, 30)), "Open now · closes at 24:00");
  assert.strictEqual(line("Fr 20:00-26:00", at(5, 21)), "Open now · closes tomorrow at 02:00");
});

test("24/7, written out or not", () => {
  assert.deepStrictEqual(status("24/7", at(MO, 3)), { kind: "always" });
  assert.deepStrictEqual(status("Mo-Su 00:00-24:00", at(WE, 3)), { kind: "always" });
  assert.strictEqual(line("24/7", at(MO, 3)), "Open 24/7");
  // Every day but not around the clock is not 24/7.
  assert.strictEqual(line("Mo-Su 00:00-23:59", at(WE, 3)), "Open now · closes at 23:59");
});

test("unknown is never closed", () => {
  assert.strictEqual(line(null, at(MO, 10)), "Opening hours unknown");
  assert.strictEqual(line("", at(MO, 10)), "Opening hours unknown");
  assert.strictEqual(line("by appointment", at(MO, 10)), "Opening hours unknown");
  // A rule hours.js can't read (months): open when a known rule says so, never closed.
  const seasonal = "Mo-Fr 08:00-18:00; Jul-Aug Mo-Fr 09:00-12:00";
  assert.strictEqual(line(seasonal, at(MO, 10)), "Open now");      // no closing time: it may differ in summer
  assert.strictEqual(line(seasonal, at(SA, 10)), "Opening hours unknown");
  assert.strictEqual(line(seasonal, at(MO, 20)), "Opening hours unknown");
});

test("a sweep through the week: the text agrees with hours.js, times are ahead, unknown stays unknown", () => {
  const cases = [VET, "Mo-Fr 08:00-12:00,13:30-18:00", "Mo-Su 18:00-08:00", "Fr 20:00-26:00", "Mo,We,Fr 09:00-17:00; Sa off",
    "Mo-Fr 08:00-18:00; Jul-Aug off", "Mo-Fr 08:00-18:00; We 08:00-12:00", "Mo-Sa 07:30-21:00, Su 10:00-14:00", "Mo-Fr 16:00-24:00"];
  for (const str of cases) {
    const w = hours.week(str);
    const complete = !!w && !w.always && w.complete;
    for (let day = 0; day < 7; day++) {
      for (let m = 0; m < 1440; m += 5) {
        const now = { day, minutes: m }, s = status(str, now), e = hours.evaluate(str, now)!;
        assert.strictEqual(s.kind === "open" || s.kind === "always", e.open === true, `${str} @${day} ${m}: ${s.kind} vs ${e.open}`);
        if (s.kind === "closed") {
          assert.ok(complete, `${str} @${day} ${m}: closed although not every rule was read`);
          assert.ok(s.opens, `${str} @${day} ${m}: closed with no opening`);
        }
        if (s.kind === "open" && s.closes) assert.ok(s.closes.daysAhead * 1440 + s.closes.minutes > m, `${str} @${day} ${m}: closes in the past`);
        if (s.kind === "closed" && s.opens) {
          assert.ok(s.opens.daysAhead * 1440 + s.opens.minutes > m, `${str} @${day} ${m}: opens in the past`);
          // At the opening time it is open.
          assert.strictEqual(hours.evaluate(str, { day: s.opens.day, minutes: s.opens.minutes })!.open, true, `${str} @${day} ${m}: not open when it opens`);
        }
        if (s.kind === "open" && s.closes) {
          const c = s.closes, before = c.minutes === 0 ? { day: (c.day + 6) % 7, minutes: 1439 } : { day: c.day, minutes: c.minutes - 1 };
          assert.strictEqual(hours.evaluate(str, before)!.open, true, `${str} @${day} ${m}: closed before it closes`);
          assert.strictEqual(hours.evaluate(str, { day: c.day, minutes: c.minutes })!.open, false, `${str} @${day} ${m}: still open when it closes`);
        }
      }
    }
  }
});

test("read on the place's clock (time zone)", () => {
  const sat0930utc = new Date("2026-11-21T09:30:00Z");   // a Saturday
  const s = "Sa 10:00-12:00";
  assert.strictEqual(line(s, sat0930utc, "Europe/Paris"), "Open now · closes at 12:00");     // 10:30 there
  assert.strictEqual(line(s, sat0930utc, "Europe/London"), "Closed · opens at 10:00");      // 09:30 there
  assert.strictEqual(line(s, sat0930utc, "Europe/Athens"), "Open now · closes at 12:00");   // 11:30 there
  assert.strictEqual((status(s, sat0930utc, "Europe/Athens") as Extract<Status, { kind: "open" }>).soon, true);
  // Late Saturday in UTC is already Sunday in Athens.
  assert.strictEqual(line("Su 00:00-02:00", new Date("2026-11-21T22:30:00Z"), "Europe/Athens"), "Open now · closes at 02:00");
});

test("the week as a table: Monday first, today marked, closed or not known", () => {
  const rows = weekRows(hours.week(VET), SA)!;
  assert.deepStrictEqual(rows.map((r) => r.day), [1, 2, 3, 4, 5, 6, 0]);
  assert.deepStrictEqual(rows[0].ranges, ["08:00 – 18:00"]);
  assert.deepStrictEqual(rows[5], { day: SA, ranges: ["09:00 – 12:00"], closed: false, unknown: false, today: true });
  assert.deepStrictEqual(rows[6], { day: SU, ranges: [], closed: true, unknown: false, today: false });
  // Not every rule read: an empty day is not known, not closed.
  const partial = weekRows(hours.week("Mo-Fr 08:00-18:00; Jul-Aug Sa 09:00-12:00"), MO)!;
  assert.strictEqual(partial[5].closed, false);
  assert.strictEqual(partial[5].unknown, true);
  assert.strictEqual(partial[0].today, true);
  // Ranges in order, also when added out of order.
  assert.deepStrictEqual(weekRows(hours.week("Mo 14:00-18:00, Mo 08:00-12:00"), SU)![0].ranges, ["08:00 – 12:00", "14:00 – 18:00"]);
  assert.strictEqual(weekRows(hours.week("24/7"), MO), null);
  assert.strictEqual(weekRows(hours.week(null), MO), null);
  assert.strictEqual(weekRows(hours.week("by appointment"), MO), null);
});

test("public holidays, when the data says so", () => {
  assert.deepStrictEqual(publicHolidays(VET), { closed: true });
  assert.deepStrictEqual(publicHolidays("Mo-Sa 09:00-18:00; Su,PH off"), { closed: true });
  assert.deepStrictEqual(publicHolidays("Mo-Fr 09:00-18:00; Sun,PH 10:00-12:00"), { closed: false, ranges: [[600, 720]] });
  assert.deepStrictEqual(publicHolidays("Mo-Fr 09:00-17:00, PH 10:00-12:00"), { closed: false, ranges: [[600, 720]] });
  assert.deepStrictEqual(publicHolidays("PH off; PH 10:00-13:00"), { closed: false, ranges: [[600, 780]] });   // the last rule wins
  assert.strictEqual(publicHolidays("Mo-Fr 08:00-18:00"), null);
  assert.strictEqual(publicHolidays("Mo-Fr 08:00-18:00; PH by appointment"), null);
  assert.strictEqual(publicHolidays(null), null);
  // hours.js itself ignores them: a public-holiday rule never closes a normal day.
  assert.strictEqual(line(VET, at(MO, 10)), "Open now · closes at 18:00");
});

test("day names in the app's language", () => {
  assert.deepStrictEqual(dayNames("en"), ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  assert.strictEqual(dayNames("nl")[2], "dinsdag");
  assert.strictEqual(capitalize(dayNames("nl")[2]), "Dinsdag");
  assert.strictEqual(dayNames("de")[1], "Montag");
  assert.strictEqual(dayNames("sr")[1], "ponedeljak");   // the app's Serbian is Latin script
  assert.strictEqual(dayNames("uk")[1], "понеділок");
  const nl = (key: string, vars: Record<string, string | number> = {}) => {
    const pack = JSON.parse(fs.readFileSync(new URL("../src/i18n/app/nl.json", import.meta.url), "utf8"));
    return String(pack[key]).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  };
  assert.strictEqual(statusText(status(VET, at(SA, 12)), nl, dayNames("nl")), "Gesloten · opent maandag om 08:00");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
