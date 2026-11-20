// Types of the dog file and the short summary sent with AI questions.
// No app imports, so tests/dogsummary.test.ts runs in plain Node.

export type RecordKind = "symptom" | "visit" | "diagnosis" | "medication" | "allergy" | "weight" | "behaviour" | "note" | "ai";
export const RECORD_KINDS: { kind: RecordKind; icon: string; key: string }[] = [
  { kind: "symptom", icon: "🌡️", key: "app_rec_symptom" },
  { kind: "visit", icon: "🩺", key: "app_rec_visit" },
  { kind: "diagnosis", icon: "📋", key: "app_rec_diagnosis" },
  { kind: "medication", icon: "💊", key: "app_rec_medication" },
  { kind: "allergy", icon: "⚠️", key: "app_rec_allergy" },
  { kind: "weight", icon: "⚖️", key: "app_rec_weight" },
  { kind: "behaviour", icon: "🐾", key: "app_rec_behaviour" },
  { kind: "note", icon: "📝", key: "app_rec_note" },
  { kind: "ai", icon: "💬", key: "app_rec_ai" }
];
// Categories of an observed sign ("symptom" entries), as the AI chat returns them
// (each has a label app_sign_<category>). "reproductive" is asked for in ai.ts (features).
export const SIGN_CATEGORIES = ["appetite", "drinking", "vomiting", "stool", "urination", "skin", "eyes_ears", "mouth", "mobility", "neuro", "breathing", "energy", "behaviour", "injury", "reproductive", "other"] as const;
export type SignCategory = (typeof SIGN_CATEGORIES)[number];
export const signCategory = (v: unknown): SignCategory => (SIGN_CATEGORIES as readonly string[]).includes(String(v)) ? (v as SignCategory) : "other";

export interface DogRecord { id: number; dogId: number; kind: RecordKind; date: string; title: string; details: string | null; value: number | null; category?: SignCategory | null }

export const SUMMARY_MAX = 1400;

/**
 * Signs that came back: per category, the dates of the last `days` days when it
 * occurred at least twice (oldest date first). Newest category first.
 */
export function recurring(records: DogRecord[], now = new Date(), days = 183): { category: SignCategory; dates: string[] }[] {
  const from = new Date(now.getTime() - days * 864e5).toISOString().slice(0, 10);
  const by = new Map<SignCategory, Set<string>>();
  for (const r of records) {
    if (r.kind !== "symptom" || r.date < from) continue;
    const c = signCategory(r.category);
    if (c === "other") continue;   // too mixed to call it a pattern
    if (!by.has(c)) by.set(c, new Set());
    by.get(c)!.add(r.date);
  }
  return [...by.entries()].filter(([, d]) => d.size >= 2)
    .map(([category, d]) => ({ category, dates: [...d].sort() }))
    .sort((a, b) => (a.dates[a.dates.length - 1] < b.dates[b.dates.length - 1] ? 1 : -1));
}

/**
 * A short summary for the AI (English labels; the model answers in the user's
 * language anyway): allergies and diagnoses always, medication of the last six
 * months, the weight trend, and the most recent events of the past year.
 * `records` newest first, as listRecords() returns them.
 */
export function summarise(records: DogRecord[], now = new Date()): string | null {
  if (!records.length) return null;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const sixMonths = iso(new Date(now.getTime() - 183 * 864e5)), year = iso(new Date(now.getTime() - 365 * 864e5));
  const clean = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);
  const line = (r: DogRecord) => `${r.date} ${clean(r.title, 100)}${r.details && r.kind !== "ai" ? " (" + clean(r.details, 80) + ")" : ""}`;
  const parts: string[] = [];
  const allergies = records.filter((r) => r.kind === "allergy");
  if (allergies.length) parts.push("Allergies: " + allergies.map((r) => clean(r.title, 60)).join("; "));
  const diagnoses = records.filter((r) => r.kind === "diagnosis").slice(0, 6);
  if (diagnoses.length) parts.push("Diagnoses: " + diagnoses.map(line).join("; "));
  const meds = records.filter((r) => r.kind === "medication" && r.date >= sixMonths);
  if (meds.length) parts.push("Medication (last 6 months): " + meds.map(line).join("; "));
  const weights = records.filter((r) => r.kind === "weight" && r.value).reverse();   // oldest first
  if (weights.length > 1) parts.push(`Weight: ${weights[0].value} kg (${weights[0].date}) -> ${weights[weights.length - 1].value} kg (${weights[weights.length - 1].date})`);
  // Observed signs with their dates: the AI can then say "the second time in three weeks".
  const signs = records.filter((r) => r.kind === "symptom" && r.date >= year).slice(0, 12);
  if (signs.length) parts.push("Observed signs: " + signs.map((r) => `${r.date} [${signCategory(r.category)}] ${clean(r.title, 60)}${r.details ? " (" + clean(r.details, 90) + ")" : ""}`).join("; "));
  const label: Partial<Record<RecordKind, string>> = { ai: "asked AI: ", behaviour: "behaviour: ", visit: "vet visit: " };
  const events = records.filter((r) => ["visit", "behaviour", "note", "ai"].includes(r.kind) && r.date >= year).slice(0, 8);
  if (events.length) parts.push("Recent: " + events.map((r) => (label[r.kind] || "") + line(r)).join("; "));
  const text = parts.join("\n");
  return text ? text.slice(0, SUMMARY_MAX) : null;
}
