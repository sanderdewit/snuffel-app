// Calendar helpers for profiles and reminders (local dates, YYYY-MM-DD).
// No imports, so tests/dates.test.ts runs in plain Node.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const today = () => isoDate(new Date());

export function validDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const d = new Date(s + "T12:00:00");
  return !isNaN(d.getTime()) && isoDate(d) === s;
}

/** Same day n months later, clamped to the month's end (31 Jan + 1 = 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return isoDate(d);
}

/** Whole months since birth, or null for no / invalid / future dates. */
export function ageMonths(birth: string | null, now = new Date()): number | null {
  if (!birth || !validDate(birth)) return null;
  const b = new Date(birth + "T12:00:00");
  let m = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) m--;
  return m >= 0 ? m : null;
}
