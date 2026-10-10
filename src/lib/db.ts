// Everything the app remembers lives in one SQLite file on the phone: dogs,
// reminders, saved places, chats, settings and the offline copy of place data.
// Nothing is sent anywhere (see the privacy text).
import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("snuffel.db");

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS cells (id TEXT PRIMARY KEY, version TEXT NOT NULL, body TEXT NOT NULL, fetched INTEGER NOT NULL, pinned INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS saved (id TEXT PRIMARY KEY, place TEXT NOT NULL, my_vet INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS dogs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, breed TEXT, birth TEXT, weight REAL, sex TEXT, neutered INTEGER, photo TEXT);
   CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, dog_id INTEGER NOT NULL, kind TEXT NOT NULL, due TEXT, every_months INTEGER NOT NULL, notif_id TEXT,
     UNIQUE (dog_id, kind));
   CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, dog_id INTEGER, role TEXT NOT NULL, content TEXT NOT NULL, urgency TEXT, topic TEXT, at INTEGER NOT NULL);`
];

let ready: Promise<void> | null = null;
export function dbReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
      const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
      for (let v = row ? row.user_version : 0; v < MIGRATIONS.length; v++) {
        await db.withTransactionAsync(async () => {
          await db.execAsync(MIGRATIONS[v]);
          await db.execAsync(`PRAGMA user_version = ${v + 1}`);
        });
      }
    })();
  }
  return ready;
}

export { db };

export async function kvGet(k: string): Promise<string | null> {
  await dbReady();
  const row = await db.getFirstAsync<{ v: string }>("SELECT v FROM kv WHERE k = ?", k);
  return row ? row.v : null;
}
export async function kvSet(k: string, v: string | null): Promise<void> {
  await dbReady();
  if (v == null) await db.runAsync("DELETE FROM kv WHERE k = ?", k);
  else await db.runAsync("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", k, v);
}
export async function kvGetJson<T>(k: string): Promise<T | null> {
  const v = await kvGet(k);
  if (v == null) return null;
  try { return JSON.parse(v) as T; } catch { return null; }
}
export const kvSetJson = (k: string, v: unknown) => kvSet(k, v == null ? null : JSON.stringify(v));
