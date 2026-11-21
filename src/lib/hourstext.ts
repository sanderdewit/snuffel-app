// Opening hours as people read them: "Open now · closes at 12:00", "Closed · opens
// Tuesday at 09:00", "Open 24/7", and the week as a table (day names in the app's
// language, today marked, public holidays when the data says so).
//
// The rules themselves are read by src/core/hours.js (shared with the website); this
// module only turns its answers into text. It imports types only, so
// tests/hourstext.test.ts runs it in plain Node against the real hours.js: callers
// hand in the engine (places.ts: HOURS).
//
// Safety first (Emergency hides closed vets): nothing here ever turns "unknown" into
// "closed". hours.js says "closed" only when every rule was understood; a day the
// week can't account for is "not known", and a closing or opening time is shown
// only when nextChange() could tell it for sure.
import type { Change, evaluate, nextChange, Week, week } from "../core/hours";

/** The three hours.js functions used here (places.ts passes the real ones). */
export interface HoursEngine { evaluate: typeof evaluate; nextChange: typeof nextChange; week: typeof week }
export type Tf = (key: string, vars?: Record<string, string | number>) => string;
/** A moment on the place's wall clock: day 0 = Sunday, minutes past midnight. */
export interface Clock { day: number; minutes: number }
/** When something happens: weekday, minutes past midnight, and how many days from today. */
export type At = Change["at"];

export type Status =
  | { kind: "always" }                                   // open 24/7
  | { kind: "open"; closes: At | null; soon: boolean }   // closes: null = can't be told; soon: within the hour
  | { kind: "closed"; opens: At | null }                 // opens: null = can't be told (or not within a week)
  | { kind: "unknown" };                                 // no hours, or none that could be read

const DAY_MIN = 1440;
const SOON_MIN = 60;

// ---- the place's clock ----

// One formatter per time zone (creating one is slow); the same reading as hours.js's
// marketNow(), so "today" here is the day hours.js evaluates.
const clockFormats: Record<string, Intl.DateTimeFormat> = {};
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The weekday and time at the place (its time zone; undefined = the phone's). */
export function placeClock(now: Date | Clock, tz?: string): Clock {
  if (!(now instanceof Date)) return now;
  const key = tz || "";
  const fmt = clockFormats[key] || (clockFormats[key] = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }));
  const v: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) v[p.type] = p.value;
  // "% 24": some engines print midnight as "24" despite h23 (as in hours.js).
  return { day: WEEKDAY[v.weekday], minutes: (Number(v.hour) % 24) * 60 + Number(v.minute) };
}

// ---- status ----

/** Every day open from 00:00 to 24:00 (written out instead of "24/7"). */
function allWeek(w: Week | null): boolean {
  if (!w || w.always) return !!w;
  if (!w.complete) return false;
  return w.days.every((ranges) => ranges.some(([a, b]) => a === 0 && b >= DAY_MIN));
}

const minutesUntil = (at: At, from: Clock) => at.daysAhead * DAY_MIN + at.minutes - from.minutes;

/**
 * Is it open now, and until when (or when does it open)? `now` is a Date (read on the
 * place's clock in `tz`) or a Clock. The engine is asked once, at one moment, so the
 * state and the time always agree.
 */
export function hoursStatus(engine: HoursEngine, str: string | null | undefined, tz: string | undefined, now: Date | Clock = new Date()): Status {
  if (!str) return { kind: "unknown" };
  const at = placeClock(now, tz);
  const state = engine.evaluate(str, at, tz);
  if (!state) return { kind: "unknown" };
  if (state.always) return { kind: "always" };
  if (state.open == null) return { kind: "unknown" };
  const change = engine.nextChange(str, at, tz);
  if (state.open) {
    // A closing time only when nextChange agrees it is open (it always should).
    const closes = change && change.open ? change.at : null;
    if (!closes && allWeek(engine.week(str))) return { kind: "always" };
    return { kind: "open", closes, soon: !!closes && minutesUntil(closes, at) <= SOON_MIN };
  }
  return { kind: "closed", opens: change && !change.open ? change.at : null };
}

/**
 * After it closes: when it opens again ("Then closed until Monday at 08:00"), counted
 * from today. Null when it isn't open now with a known closing time, or the next
 * opening can't be told.
 */
export function reopensAfter(engine: HoursEngine, str: string | null | undefined, tz: string | undefined, s: Status): At | null {
  if (!str || s.kind !== "open" || !s.closes) return null;
  const c = s.closes;
  const next = engine.nextChange(str, { day: c.day, minutes: c.minutes }, tz);
  if (!next || next.open) return null;
  return { day: next.at.day, minutes: next.at.minutes, daysAhead: c.daysAhead + next.at.daysAhead };
}

// ---- text ----

const pad = (n: number) => String(n).padStart(2, "0");
/** Minutes past midnight as "09:00"; 1440 or more runs into the next day ("26:00" is "02:00"). */
export const hhmm = (m: number) => { const x = ((m % DAY_MIN) + DAY_MIN) % DAY_MIN; return pad(Math.floor(x / 60)) + ":" + pad(x % 60); };

/** A closing at midnight reads "closes at 24:00", not "closes tomorrow at 00:00". */
function closingTime(at: At): { daysAhead: number; day: number; time: string } {
  if (at.minutes === 0 && at.daysAhead > 0) return { daysAhead: at.daysAhead - 1, day: (at.day + 6) % 7, time: "24:00" };
  return { daysAhead: at.daysAhead, day: at.day, time: hhmm(at.minutes) };
}

// Today, tomorrow or a weekday, per kind of sentence.
const KEYS = {
  closes: ["app_closesAt", "app_closesTomorrow", "app_closesOn"],
  opens: ["app_opensAt", "app_opensTomorrow", "app_opensOn"],
  then: ["app_thenUntil", "app_thenUntilTomorrow", "app_thenUntilOn"]
} as const;

function when(kind: keyof typeof KEYS, w: { daysAhead: number; day: number; time: string }, tf: Tf, days: string[]): string {
  const k = KEYS[kind][Math.min(w.daysAhead, 2)];
  return tf(k, { time: w.time, day: days[w.day] });
}

/** "Open now · closes at 12:00", "Closed · opens Tuesday at 09:00", "Open 24/7", "Opening hours unknown". */
export function statusText(s: Status, tf: Tf, days: string[]): string {
  switch (s.kind) {
    case "always": return tf("open247");
    case "unknown": return tf("hoursUnknown");
    case "open": return s.closes ? when("closes", closingTime(s.closes), tf, days) : tf("openNow");
    case "closed": return s.opens ? when("opens", { daysAhead: s.opens.daysAhead, day: s.opens.day, time: hhmm(s.opens.minutes) }, tf, days) : tf("closedNow");
  }
}

/** "Then closed until Monday at 08:00" (see reopensAfter). */
export function reopensText(at: At, tf: Tf, days: string[]): string {
  return when("then", { daysAhead: at.daysAhead, day: at.day, time: hhmm(at.minutes) }, tf, days);
}

// ---- day names ----

const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayCache: Record<string, string[]> = {};
// The app's English is British; its Serbian is written in Latin script.
const LOCALE: Record<string, string> = { en: "en-GB", sr: "sr-Latn" };

/** Day names, 0 = Sunday, in the app language (Intl); English when Intl can't. */
export function dayNames(lang: string): string[] {
  if (dayCache[lang]) return dayCache[lang];
  let names = EN_DAYS;
  try {
    const fmt = new Intl.DateTimeFormat(LOCALE[lang] || lang, { weekday: "long", timeZone: "UTC" });
    const got = [0, 1, 2, 3, 4, 5, 6].map((d) => fmt.format(new Date(Date.UTC(2024, 0, 7 + d))));   // 7 Jan 2024 was a Sunday
    if (new Set(got).size === 7 && got.every((n) => n && !/\d/.test(n))) names = got;
  } catch { /* English */ }
  return (dayCache[lang] = names);
}

/** First letter upper case, for a day name at the start of a table row ("dinsdag" -> "Dinsdag"). */
export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---- the week ----

/** The order of a week table: Monday first (ISO 8601, as everywhere the app covers). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface DayRow {
  day: number;          // 0 = Sunday
  ranges: string[];     // "08:00 – 18:00", in order; empty when closed or not known
  closed: boolean;      // known to be closed all day
  unknown: boolean;     // no rule for this day could be read
  today: boolean;
}

/** "08:00 – 18:00"; an end past midnight shows its clock time ("18:00 – 02:00"); midnight as an end is 24:00. */
export function rangeText([a, b]: [number, number]): string {
  const end = b === DAY_MIN ? "24:00" : hhmm(b);
  return hhmm(a) + " – " + end;
}

/** The week as table rows, Monday first. Null for no or unreadable hours and for 24/7. */
export function weekRows(w: Week | null, today: number): DayRow[] | null {
  if (!w || w.always) return null;
  return WEEK_ORDER.map((d) => {
    const ranges = [...w.days[d]].sort((x, y) => x[0] - y[0]);
    return {
      day: d,
      ranges: ranges.map(rangeText),
      closed: !ranges.length && w.complete,
      unknown: !ranges.length && !w.complete,
      today: d === today
    };
  });
}

// ---- public holidays ----
// hours.js doesn't evaluate public holidays ("PH"): it skips them, so they never make
// a place look closed. For the table they are read here: the last rule that names PH.

const DAY_TOKEN = "(?:mo|tu|we|th|fr|sa|su|ph|sh)";
const DAY_SPEC = new RegExp("^(" + DAY_TOKEN + "(?:\\s*[-,]\\s*" + DAY_TOKEN + ")*)\\b\\s*(.*)$");
const COMPLEX = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|week|easter)\b|\[|sunrise|sunset|dawn|dusk/;
// Not spec, but common: "Sun,PH off" (as hours.js reads them).
const LONG_DAY = /\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/g;

export type Holidays = { closed: true; ranges?: undefined } | { closed: false; ranges: [number, number][] };

/** Public holidays as the data gives them ("PH off", "Su,PH 10:00-12:00"), or null when it says nothing readable. */
export function publicHolidays(str: string | null | undefined): Holidays | null {
  if (!str) return null;
  const s = String(str).split("||")[0].toLowerCase().replace(LONG_DAY, (m) => m.slice(0, 2));
  let out: Holidays | null = null;
  // Rules are separated by ";", and by "," between a time or "off" and a weekday (as hours.js).
  const rules = s.split(";").flatMap((part) => part.replace(/(\d|off|closed)\s*,\s*(?=(?:mo|tu|we|th|fr|sa|su|ph)\b)/g, "$1\u0000").split("\u0000"));
  for (const raw of rules) {
    const rule = raw.trim();
    const m = DAY_SPEC.exec(rule);
    if (!m || COMPLEX.test(rule)) continue;
    if (!m[1].split(/[-,]/).some((t) => t.trim() === "ph")) continue;
    if (/\b(off|closed)\b/.test(m[2])) { out = { closed: true }; continue; }
    const ranges: [number, number][] = [];
    const re = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
    let r: RegExpExecArray | null;
    while ((r = re.exec(m[2]))) ranges.push([Number(r[1]) * 60 + Number(r[2]), Number(r[3]) * 60 + Number(r[4])]);
    if (ranges.length) out = { closed: false, ranges };
  }
  return out;
}
