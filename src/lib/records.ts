// The dog file's entries in SQLite, for the writes that must never go wrong: an edit
// changes that one entry of that dog and nothing else, and a weight keeps the
// profile's weight current. The database is passed in (the app's expo-sqlite one,
// src/lib/dogfile.ts), and there are no app imports, so tests/dogfile.test.ts runs
// this on Node's own SQLite against the app's real schema (src/lib/db.ts).
import type { DogRecord } from "./dogsummary";

type Bind = string | number | null;
export interface SqlDb {
  runAsync(source: string, ...params: Bind[]): Promise<{ changes: number }>;
  getFirstAsync<T>(source: string, ...params: Bind[]): Promise<T | null>;
}

/** A sign filed from the AI chat this recently is refined by the chat's next note of the same kind (fileObservation). */
export const SAME_EPISODE_MS = 12 * 3600 * 1000;

/** The latest weight entry keeps the profile's weight current. */
export async function syncWeight(db: SqlDb, dogId: number): Promise<void> {
  const latest = await db.getFirstAsync<{ value: number }>(
    "SELECT value FROM records WHERE dog_id = ? AND kind = 'weight' AND value IS NOT NULL ORDER BY date DESC, id DESC", dogId);
  if (latest) await db.runAsync("UPDATE dogs SET weight = ? WHERE id = ?", latest.value, dogId);
}

/**
 * Writes an edited entry (as cleanRecord returns it) over the stored entry with the
 * same id of the same dog; false when there is none (deleted meanwhile).
 * After the owner's edit the entry is theirs: the chat no longer refines it (its
 * `created`, used only for that, is moved out of the episode window), so a later
 * note from the chat becomes a new entry instead of overwriting the owner's words.
 */
export async function writeRecord(db: SqlDb, r: DogRecord, now = Date.now()): Promise<boolean> {
  const before = await db.getFirstAsync<{ kind: string }>("SELECT kind FROM records WHERE id = ? AND dog_id = ?", r.id, r.dogId);
  if (!before) return false;
  await db.runAsync(
    "UPDATE records SET kind = ?, date = ?, title = ?, details = ?, value = ?, category = ?, created = MIN(created, ?) WHERE id = ? AND dog_id = ?",
    r.kind, r.date, r.title, r.details, r.value, r.category ?? null, now - SAME_EPISODE_MS - 1, r.id, r.dogId);
  if (before.kind === "weight" || r.kind === "weight") await syncWeight(db, r.dogId);
  return true;
}
