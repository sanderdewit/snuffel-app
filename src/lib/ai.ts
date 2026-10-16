// The same /api/chat service as the website. The app adds a random install ID
// (rate limiting per install: phones on mobile data often share one IP) and,
// when a dog is chosen, its profile so advice fits that dog.
import * as Crypto from "expo-crypto";
import { CONFIG } from "./config";
import { db, dbReady, kvGet, kvSet } from "./db";
import { ageMonths, type Dog } from "./dogs";
import { aiSummary } from "./dogfile";

export type Urgency = "emergency" | "vet_soon" | "monitor" | "unclear";
export type Topic = "health" | "behaviour" | "other";
// The structure of an answer: verdict, steps, signs to watch, follow-up questions,
// tap-to-answer replies and a short version to say out loud (empty when absent).
export interface AnswerParts { summary: string; steps: string[]; watch_for: string[]; questions: string[]; quick_replies: string[]; spoken: string }
// local: shown on screen only (an error message); never stored, never sent to the model.
// sig: the server's signature on an answer; only signed answers count as history.
export interface ChatMessage { id?: number; role: "user" | "assistant"; content: string; urgency?: Urgency; topic?: Topic; local?: boolean; sig?: string; parts?: AnswerParts }
export type AskResult = { reply: string; urgency: Urgency; topic: Topic; sig?: string; parts?: AnswerParts } | { error: "rate_limited" | "unavailable" | "failed" };

async function installId(): Promise<string> {
  let id = await kvGet("installId");
  if (!id) { id = Crypto.randomUUID(); await kvSet("installId", id); }
  return id;
}

export async function ask(all: ChatMessage[], lang: string, emergencyLabel: string, dog: Dog | null): Promise<AskResult> {
  const history = all.filter((m) => !m.local);
  const body: Record<string, unknown> = {
    lang, emergencyLabel,
    // The last 12 turns, but always the first question: it usually describes the problem.
    messages: (history.length > 12 ? [history[0], ...history.slice(-11)] : history).map((m) => (m.role === "assistant" ? { role: m.role, content: m.content, sig: m.sig } : { role: m.role, content: m.content }))
  };
  if (dog) {
    body.dog = {
      name: dog.name || undefined, breed: dog.breed || undefined, ageMonths: ageMonths(dog.birth) ?? undefined, weightKg: dog.weight ?? undefined,
      sex: dog.sex ?? undefined, neutered: dog.neutered ?? undefined,
      history: (await aiSummary(dog.id).catch(() => null)) ?? undefined   // only when the owner allows it for this dog
    };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(CONFIG.chatApi, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Snuffel-Install": await installId() },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if (r.status === 429) return { error: "rate_limited" };
    if (!r.ok) return { error: "failed" };
    const d = await r.json();
    if (!d.configured) return { error: "unavailable" };
    return { reply: d.reply, urgency: d.urgency, topic: d.topic, sig: typeof d.sig === "string" ? d.sig : undefined, parts: answerParts(d) };
  } catch {
    return { error: "failed" };
  } finally { clearTimeout(timer); }
}

// Chats are kept on the phone, one thread per dog (null = no specific dog).
export async function loadChat(dogId: number | null): Promise<ChatMessage[]> {
  await dbReady();
  const rows = await db.getAllAsync<any>(dogId == null ? "SELECT * FROM chats WHERE dog_id IS NULL ORDER BY id" : "SELECT * FROM chats WHERE dog_id = ? ORDER BY id",
    ...(dogId == null ? [] : [dogId]));
  return rows.map((r) => ({ id: r.id, role: r.role, content: r.content, urgency: r.urgency || undefined, topic: r.topic || undefined, sig: r.sig || undefined,
    parts: r.parts ? answerParts(safeJson(r.parts)) : undefined }));
}
export async function addChat(dogId: number | null, m: ChatMessage): Promise<void> {
  await dbReady();
  await db.runAsync("INSERT INTO chats (dog_id, role, content, urgency, topic, sig, parts, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    dogId, m.role, m.content, m.urgency || null, m.topic || null, m.sig || null, m.parts ? JSON.stringify(m.parts) : null, Date.now());
}
export async function clearChat(dogId: number | null): Promise<void> {
  await dbReady();
  if (dogId == null) await db.runAsync("DELETE FROM chats WHERE dog_id IS NULL");
  else await db.runAsync("DELETE FROM chats WHERE dog_id = ?", dogId);
}

const safeJson = (s: string): unknown => { try { return JSON.parse(s); } catch { return null; } };
const strs = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, n) : []);
/** Validated answer parts, or undefined when the answer has no structure (older server / stored chats). */
export function answerParts(d: unknown): AnswerParts | undefined {
  const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
  const p: AnswerParts = {
    summary: typeof o.summary === "string" ? o.summary : "",
    steps: strs(o.steps, 3), watch_for: strs(o.watch_for, 4), questions: strs(o.questions, 2),
    quick_replies: strs(o.quick_replies, 4), spoken: typeof o.spoken === "string" ? o.spoken : ""
  };
  return p.summary || p.steps.length || p.spoken ? p : undefined;
}
