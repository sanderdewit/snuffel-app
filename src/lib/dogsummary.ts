// Types of the dog file and the short summary sent with AI questions.
// No app imports, so tests/dogsummary.test.ts runs in plain Node.

export type RecordKind = "visit" | "diagnosis" | "medication" | "allergy" | "weight" | "behaviour" | "note" | "ai";
export const RECORD_KINDS: { kind: RecordKind; icon: string; key: string }[] = [
  { kind: "visit", icon: "🩺", key: "app_rec_visit" },
  { kind: "diagnosis", icon: "📋", key: "app_rec_diagnosis" },
  { kind: "medication", icon: "💊", key: "app_rec_medication" },
  { kind: "allergy", icon: "⚠️", key: "app_rec_allergy" },
  { kind: "weight", icon: "⚖️", key: "app_rec_weight" },
  { kind: "behaviour", icon: "🐾", key: "app_rec_behaviour" },
  { kind: "note", icon: "📝", key: "app_rec_note" },
  { kind: "ai", icon: "💬", key: "app_rec_ai" }
];
export interface DogRecord { id: number; dogId: number; kind: RecordKind; date: string; title: string; details: string | null; value: number | null }

export const SUMMARY_MAX = 1400;

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
  const label: Partial<Record<RecordKind, string>> = { ai: "asked AI: ", behaviour: "behaviour: ", visit: "vet visit: " };
  const events = records.filter((r) => ["visit", "behaviour", "note", "ai"].includes(r.kind) && r.date >= year).slice(0, 8);
  if (events.length) parts.push("Recent: " + events.map((r) => (label[r.kind] || "") + line(r)).join("; "));
  const text = parts.join("\n");
  return text ? text.slice(0, SUMMARY_MAX) : null;
}
