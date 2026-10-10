// Saved places and "my vet". The whole place is stored, so it works offline.
import { db, dbReady } from "./db";
import { refreshOpenState, type Place } from "./places";

export interface SavedPlace extends Place { myVet: boolean }

export async function listSaved(): Promise<SavedPlace[]> {
  await dbReady();
  const rows = await db.getAllAsync<{ place: string; my_vet: number }>("SELECT place, my_vet FROM saved ORDER BY my_vet DESC, added DESC");
  return refreshOpenState(rows.map((r) => ({ ...(JSON.parse(r.place) as Place), myVet: !!r.my_vet })));
}
export async function isSaved(id: string): Promise<{ saved: boolean; myVet: boolean }> {
  await dbReady();
  const row = await db.getFirstAsync<{ my_vet: number }>("SELECT my_vet FROM saved WHERE id = ?", id);
  return { saved: !!row, myVet: !!(row && row.my_vet) };
}
export async function save(p: Place): Promise<void> {
  await dbReady();
  await db.runAsync("INSERT INTO saved (id, place, my_vet, added) VALUES (?, ?, 0, ?) ON CONFLICT(id) DO UPDATE SET place = excluded.place",
    p.id, JSON.stringify(p), Date.now());
}
export async function unsave(id: string): Promise<void> {
  await dbReady();
  await db.runAsync("DELETE FROM saved WHERE id = ?", id);
}
/** Only one "my vet"; setting it also saves the place. */
export async function setMyVet(p: Place, on: boolean): Promise<void> {
  await dbReady();
  await db.withTransactionAsync(async () => {
    if (on) {
      await db.runAsync("UPDATE saved SET my_vet = 0");
      await db.runAsync("INSERT INTO saved (id, place, my_vet, added) VALUES (?, ?, 1, ?) ON CONFLICT(id) DO UPDATE SET my_vet = 1, place = excluded.place",
        p.id, JSON.stringify(p), Date.now());
    } else {
      await db.runAsync("UPDATE saved SET my_vet = 0 WHERE id = ?", p.id);
    }
  });
}
export async function myVet(): Promise<SavedPlace | null> {
  const all = await listSaved();
  return all.find((p) => p.myVet) || null;
}
