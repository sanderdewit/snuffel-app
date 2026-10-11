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
export interface ChatMessage { id?: number; role: "user" | "assistant"; content: string; urgency?: Urgency; topic?: Topic }
export type AskResult = { reply: string; urgency: Urgency; topic: Topic } | { error: "rate_limited" | "unavailable" | "failed" };

async function installId(): Promise<string> {
  let id = await kvGet("installId");
  if (!id) { id = Crypto.randomUUID(); await kvSet("installId", id); }
  return id;
}

export async function ask(history: ChatMessage[], lang: string, emergencyLabel: string, dog: Dog | null): Promise<AskResult> {
  const body: Record<string, unknown> = {
    lang, emergencyLabel,
    messages: history.slice(-12).map((m) => ({ role: m.role, content: m.content }))
  };
  if (dog) {
    body.dog = {
      breed: dog.breed || undefined, ageMonths: ageMonths(dog.birth) ?? undefined, weightKg: dog.weight ?? undefined,
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
    return { reply: d.reply, urgency: d.urgency, topic: d.topic };
  } catch {
    return { error: "failed" };
  } finally { clearTimeout(timer); }
}

// Chats are kept on the phone, one thread per dog (null = no specific dog).
export async function loadChat(dogId: number | null): Promise<ChatMessage[]> {
  await dbReady();
  const rows = await db.getAllAsync<any>(dogId == null ? "SELECT * FROM chats WHERE dog_id IS NULL ORDER BY id" : "SELECT * FROM chats WHERE dog_id = ? ORDER BY id",
    ...(dogId == null ? [] : [dogId]));
  return rows.map((r) => ({ id: r.id, role: r.role, content: r.content, urgency: r.urgency || undefined, topic: r.topic || undefined }));
}
export async function addChat(dogId: number | null, m: ChatMessage): Promise<void> {
  await dbReady();
  await db.runAsync("INSERT INTO chats (dog_id, role, content, urgency, topic, at) VALUES (?, ?, ?, ?, ?, ?)",
    dogId, m.role, m.content, m.urgency || null, m.topic || null, Date.now());
}
export async function clearChat(dogId: number | null): Promise<void> {
  await dbReady();
  if (dogId == null) await db.runAsync("DELETE FROM chats WHERE dog_id IS NULL");
  else await db.runAsync("DELETE FROM chats WHERE dog_id = ?", dogId);
}
