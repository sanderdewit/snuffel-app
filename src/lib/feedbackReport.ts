// What a thumbs-down report contains. Built on the phone and shown in full on the
// consent screen (src/app/feedback.tsx) before anything is sent: the screen renders
// this object, so what the owner sees is exactly what goes to /api/feedback.
// Free of native modules (unit-tested in tests/feedback.test.ts).

export interface ReportTurn { role: "user" | "assistant"; content: string; urgency?: string }
export interface ReportDog { breed?: string; ageMonths?: number; weightKg?: number; sex?: "male" | "female"; neutered?: boolean }
export interface Report { appVersion: string; lang: string; messages: ReportTurn[]; dog?: ReportDog; comment?: string }

// The server's limits (api/feedback in the website repo).
export const LIMITS = { messages: 40, messageChars: 4000, totalChars: 60000, comment: 300, breed: 60 };
const URGENCIES = ["emergency", "vet_today", "vet_soon", "monitor", "unclear"];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A letter (any script with upper/lower case) or digit: a name only counts as a whole word.
const wordChar = (c: string | undefined) => !!c && (/[0-9_]/.test(c) || c.toLowerCase() !== c.toUpperCase());
const DATE = /\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{2,4}/;

/**
 * The text without the dogs' names ("[name]", whole words, any case), e-mail
 * addresses ("[email]") and phone or chip numbers ("[number]": 9 digits or more;
 * dates stay).
 */
export function scrub(text: string, names: string[]): string {
  // Placeholders first (\u0001-\u0003), the tokens at the end: a dog called "Name" can't eat "[name]".
  let out = text.replace(/[\u0001-\u0003]/g, "").replace(/[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[^\s@<>()"',;:.!?]+/g, "\u0001");
  out = out.replace(/\+?\d[\d ()./-]{7,}\d/g, (m) => (m.replace(/\D/g, "").length >= 9 && !DATE.test(m) ? "\u0002" : m));
  // The full name and each longer part of it ("Lady Di" -> also "Lady"), longest first.
  const words = new Set<string>();
  for (const n of names) {
    const full = n.trim().replace(/\s+/g, " ");
    if (!full) continue;
    words.add(full);
    for (const w of full.split(" ")) if (w.length >= 3) words.add(w);
  }
  for (const w of [...words].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(escapeRe(w), "gi"), (m: string, at: number, s: string) =>
      (wordChar(s[at - 1]) || wordChar(s[at + m.length]) ? m : "\u0003"));
  }
  return out.replace(/\u0001/g, "[email]").replace(/\u0002/g, "[number]").replace(/\u0003/g, "[name]");
}

export interface ReportInput {
  turns: { role: "user" | "assistant"; content: string; urgency?: string }[];   // up to and including the rated answer
  dog: { breed?: string | null; ageMonths?: number | null; weightKg?: number | null; sex?: "male" | "female" | null; neutered?: boolean | null } | null;
  names: string[];      // every dog's name on this phone
  comment: string;
  lang: string;
  appVersion: string;
}

/** The report, or null when there is no answer to report. */
export function buildReport(o: ReportInput): Report | null {
  const turns: ReportTurn[] = [];
  for (const t of o.turns) {
    const content = scrub(t.content, o.names).trim().slice(0, LIMITS.messageChars);
    if (!content) continue;
    turns.push(t.role === "assistant" && t.urgency && URGENCIES.includes(t.urgency) ? { role: t.role, content, urgency: t.urgency } : { role: t.role, content });
  }
  if (!turns.length || turns[turns.length - 1].role !== "assistant") return null;
  // A long conversation: the newest turns that fit.
  let total = 0;
  const messages = turns.slice(-LIMITS.messages).reverse().filter((m) => (total += m.content.length) <= LIMITS.totalChars).reverse();
  const r: Report = { appVersion: /^\d{1,3}\.\d{1,3}\.\d{1,4}$/.test(o.appVersion) ? o.appVersion : "0.0.0", lang: o.lang, messages };
  const d = o.dog;
  if (d) {
    const dog: ReportDog = {};
    const breed = (d.breed || "").replace(/\s+/g, " ").trim().slice(0, LIMITS.breed);
    if (breed) dog.breed = breed;
    if (d.ageMonths != null && Number.isInteger(d.ageMonths) && d.ageMonths >= 0 && d.ageMonths <= 360) dog.ageMonths = d.ageMonths;
    if (d.weightKg != null && Number.isFinite(d.weightKg) && d.weightKg > 0 && d.weightKg <= 150) dog.weightKg = Math.round(d.weightKg * 10) / 10;
    if (d.sex === "male" || d.sex === "female") dog.sex = d.sex;
    if (typeof d.neutered === "boolean") dog.neutered = d.neutered;
    if (Object.keys(dog).length) r.dog = dog;
  }
  const comment = scrub(o.comment, o.names).replace(/\s+/g, " ").trim().slice(0, LIMITS.comment);
  if (comment) r.comment = comment;
  return r;
}
