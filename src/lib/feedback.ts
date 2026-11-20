// Thumbs up/down under AI answers. A thumbs up, and a thumbs down that isn't sent,
// only live on the phone (table ratings). Only after the owner taps Send on the
// consent screen does a conversation go to Snuffel's /api/feedback; the removal
// code it returns is kept here with that answer, also when the chat is cleared.
import Constants from "expo-constants";
import { CONFIG } from "./config";
import { db, dbReady } from "./db";
import { ageMonths, getDog, listDogs, type Dog } from "./dogs";
import { installId } from "./install";
import { loadChat, type ChatMessage } from "./ai";
import type { Report, ReportInput } from "./feedbackReport";

export type Vote = "up" | "down";
export interface Rating { chatId: number; vote: Vote; code: string | null; title: string | null; at: number }
const rowToRating = (r: any): Rating => ({ chatId: r.chat_id, vote: r.vote === "up" ? "up" : "down", code: r.code || null, title: r.title || null, at: r.at });

export async function getRating(chatId: number): Promise<Rating | null> {
  await dbReady();
  const r = await db.getFirstAsync("SELECT * FROM ratings WHERE chat_id = ?", chatId);
  return r ? rowToRating(r) : null;
}
/** Sets or clears (null) the vote; a sent report's code is never touched. */
export async function setVote(chatId: number, vote: Vote | null): Promise<void> {
  await dbReady();
  if (vote == null) await db.runAsync("DELETE FROM ratings WHERE chat_id = ? AND code IS NULL", chatId);
  else await db.runAsync("INSERT INTO ratings (chat_id, vote, at) VALUES (?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET vote = excluded.vote WHERE code IS NULL",
    chatId, vote, Date.now());
}
async function saveCode(chatId: number, code: string, title: string): Promise<void> {
  await dbReady();
  await db.runAsync("INSERT INTO ratings (chat_id, vote, code, title, at) VALUES (?, 'down', ?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET vote = 'down', code = excluded.code, title = excluded.title, at = excluded.at",
    chatId, code, title, Date.now());
}
/** Conversations sent from this phone, newest first (Settings → Privacy). */
export async function sentReports(): Promise<Rating[]> {
  await dbReady();
  return (await db.getAllAsync("SELECT * FROM ratings WHERE code IS NOT NULL ORDER BY at DESC")).map(rowToRating);
}

/** What the consent screen needs: the conversation up to and including that answer, its dog, and every dog's name. */
export async function feedbackDraft(chatId: number): Promise<{ turns: ChatMessage[]; dog: Dog | null; names: string[] } | null> {
  await dbReady();
  const row = await db.getFirstAsync<{ dog_id: number | null; role: string }>("SELECT dog_id, role FROM chats WHERE id = ?", chatId);
  if (!row || row.role !== "assistant") return null;
  const all = await loadChat(row.dog_id);
  const turns = all.filter((m) => m.id != null && m.id <= chatId);
  const [dog, dogs] = await Promise.all([row.dog_id == null ? null : getDog(row.dog_id), listDogs()]);
  return { turns, dog, names: dogs.map((d) => d.name) };
}

/** The input for buildReport, from a draft (the screen adds the comment). */
export function reportInput(draft: { turns: ChatMessage[]; dog: Dog | null; names: string[] }, comment: string, lang: string): ReportInput {
  const d = draft.dog;
  return {
    turns: draft.turns.map((m) => ({ role: m.role, content: m.content, urgency: m.urgency })),
    dog: d ? { breed: d.breed, ageMonths: ageMonths(d.birth), weightKg: d.weight, sex: d.sex, neutered: d.neutered } : null,
    names: draft.names, comment, lang,
    appVersion: Constants.expoConfig?.version || "0.0.0"
  };
}

export type SendResult = { code: string } | { error: "unavailable" | "rate_limited" | "failed" };

/** Sends the report (only ever called from the consent screen's Send button) and keeps the removal code. */
export async function sendReport(chatId: number, report: Report): Promise<SendResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(CONFIG.feedbackApi, {
      method: "POST",
      // The install ID only counts toward the server's limits; it isn't stored with the report.
      headers: { "Content-Type": "application/json", "X-Snuffel-Install": await installId() },
      body: JSON.stringify(report),
      signal: ctrl.signal
    });
    if (r.status === 429) return { error: "rate_limited" };
    if (!r.ok) return { error: "failed" };
    const d = await r.json();
    if (!d || d.configured === false) return { error: "unavailable" };
    if (typeof d.code !== "string" || !/^[0-9A-Z]{5}-[0-9A-Z]{5}$/.test(d.code)) return { error: "failed" };
    const first = report.messages.find((m) => m.role === "user");
    // It was sent: a failure to store the code locally doesn't make it unsent (the screen still shows it).
    await saveCode(chatId, d.code, (first ? first.content : "").slice(0, 80)).catch(() => undefined);
    return { code: d.code };
  } catch {
    return { error: "failed" };
  } finally { clearTimeout(timer); }
}
