// How the health file is shown: the key facts, the entries by month, the kinds to
// filter on, and the dates that go with them. No app imports, so
// tests/dogfile.test.ts runs it in plain Node.
import type { DogRecord, RecordKind } from "./dogsummary";

const newestFirst = (a: DogRecord, b: DogRecord) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1);

/** What a vet or a sitter asks first: every allergy (newest first), the latest medication and the latest vet visit. */
export function keyFacts(records: DogRecord[]): { allergies: DogRecord[]; medication: DogRecord | null; visit: DogRecord | null } {
  const sorted = [...records].sort(newestFirst);
  return {
    allergies: sorted.filter((r) => r.kind === "allergy"),
    medication: sorted.find((r) => r.kind === "medication") ?? null,
    visit: sorted.find((r) => r.kind === "visit") ?? null
  };
}

/** Entries by month ("2026-11"), the newest month and entry first. */
export function byMonth(records: DogRecord[]): { month: string; records: DogRecord[] }[] {
  const out: { month: string; records: DogRecord[] }[] = [];
  for (const r of [...records].sort(newestFirst)) {
    const month = r.date.slice(0, 7), last = out[out.length - 1];
    if (last && last.month === month) last.records.push(r);
    else out.push({ month, records: [r] });
  }
  return out;
}

/** The kinds that occur in the file, in the given order (RECORD_KINDS). */
export function kindsIn(records: DogRecord[], order: RecordKind[]): RecordKind[] {
  const has = new Set(records.map((r) => r.kind));
  return order.filter((k) => has.has(k));
}

// As formatDate (src/lib/dates.ts): British English. Serbian is written in Latin
// script in the app (a bare "sr" is Cyrillic in Intl).
const locale = (lang: string) => (lang === "en" ? "en-GB" : lang === "sr" ? "sr-Latn" : lang);
const noon = (iso: string) => new Date(iso + "T12:00:00");
const pad = (n: number) => String(n).padStart(2, "0");
const realDay = (iso: string) => {   // as validDate: "2026-02-30" is no day
  const d = noon(iso);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(d.getTime()) && `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === iso;
};

/** A month heading, "November 2026" in the app language, with a capital (Dutch "november" -> "November"). `month` is YYYY-MM. */
export function formatMonth(month: string, lang: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;
  try {
    const s = noon(month + "-01").toLocaleDateString(locale(lang), { month: "long", year: "numeric" });
    return s.charAt(0).toLocaleUpperCase(locale(lang)) + s.slice(1);
  } catch { return month; }
}

/** "14 November": a date under its month's heading, so without the year. */
export function formatDayMonth(iso: string, lang: string): string {
  if (!realDay(iso)) return iso;
  try { return noon(iso).toLocaleDateString(locale(lang), { day: "numeric", month: "long" }); }
  catch { return iso; }
}
