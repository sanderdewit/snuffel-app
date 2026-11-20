// The note for the dog's file from an AI voice conversation (beta). When the
// owner hangs up with a dog chosen, the app asks the realtime session for one
// text answer (realtime.ts; the rules are in api/voice's instructions):
// {"observation": {date, category, title, details} | null, "urgency": ...}.
// It comes from Azure straight to the phone, never through our server, so it is
// checked here with the chat server's rules (api/chat observation()).
// Type imports only, so tests/voicenote.test.ts runs in plain Node.
import type { Urgency } from "./ai";
import type { Observation } from "./dogfile";
import type { SignCategory } from "./dogsummary";

export interface VoiceNote { observation: Observation; urgency: Urgency }

const URGENCIES: readonly Urgency[] = ["emergency", "vet_today", "vet_soon", "monitor", "unclear"];
const realDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * The model's answer as a note for the file, or null: nothing to note, or not a valid answer.
 * `category` maps the model's category name (unknown: "other"); `today` is the phone's date.
 */
export function parseVoiceNote(answer: unknown, today: string, category: (v: unknown) => SignCategory): VoiceNote | null {
  if (typeof answer !== "string") return null;
  // Just the JSON object, also when the model wraps it in a code block or a sentence.
  const from = answer.indexOf("{"), to = answer.lastIndexOf("}");
  if (from < 0 || to <= from) return null;
  let d: unknown;
  try { d = JSON.parse(answer.slice(from, to + 1)); } catch { return null; }
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  const obs = "observation" in o ? o.observation : o;   // also a bare observation
  if (!obs || typeof obs !== "object" || Array.isArray(obs)) return null;
  const n = obs as Record<string, unknown>;
  const title = text(n.title, 80);
  if (!title) return null;
  // As the chat's server does: a date that doesn't exist, lies in the future or more than a year back becomes today.
  const yearAgo = new Date(Date.parse(today + "T00:00:00Z") - 365 * 864e5).toISOString().slice(0, 10);
  const date = typeof n.date === "string" && realDate(n.date) && n.date <= today && n.date >= yearAgo ? n.date : today;
  const urgency = URGENCIES.find((u) => u === o.urgency) ?? "unclear";
  return { observation: { date, category: category(n.category), title, details: text(n.details, 300) }, urgency };
}
