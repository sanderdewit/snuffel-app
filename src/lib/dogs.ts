// Dog profiles and care reminders. Reminders are local notifications scheduled
// on the phone (no server, no push service), at 10:00 on the due date.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { db, dbReady } from "./db";

export interface Dog {
  id: number;
  name: string;
  breed: string | null;
  birth: string | null;      // YYYY-MM-DD
  weight: number | null;     // kg
  sex: "male" | "female" | null;
  neutered: boolean | null;
  photo: string | null;      // local file URI
}
export type ReminderKind = "vaccination" | "deworming" | "flea_tick" | "checkup";
export interface Reminder { id: number; dogId: number; kind: ReminderKind; due: string | null; everyMonths: number; notifId: string | null }

/** Typical intervals; the owner can follow their own vet's schedule by setting the date. */
export const REMINDER_KINDS: { kind: ReminderKind; everyMonths: number; key: string }[] = [
  { kind: "vaccination", everyMonths: 12, key: "app_rem_vaccination" },
  { kind: "deworming", everyMonths: 3, key: "app_rem_deworming" },
  { kind: "flea_tick", everyMonths: 1, key: "app_rem_flea_tick" },
  { kind: "checkup", everyMonths: 12, key: "app_rem_checkup" }
];

import { addMonths, today } from "./dates";
export { addMonths, ageMonths, isoDate, today, validDate } from "./dates";

const rowToDog = (r: any): Dog => ({ id: r.id, name: r.name, breed: r.breed, birth: r.birth, weight: r.weight,
  sex: r.sex === "male" || r.sex === "female" ? r.sex : null, neutered: r.neutered == null ? null : !!r.neutered, photo: r.photo });
const rowToReminder = (r: any): Reminder => ({ id: r.id, dogId: r.dog_id, kind: r.kind, due: r.due, everyMonths: r.every_months, notifId: r.notif_id });

export async function listDogs(): Promise<Dog[]> {
  await dbReady();
  return (await db.getAllAsync("SELECT * FROM dogs ORDER BY id")).map(rowToDog);
}
export async function getDog(id: number): Promise<Dog | null> {
  await dbReady();
  const r = await db.getFirstAsync("SELECT * FROM dogs WHERE id = ?", id);
  return r ? rowToDog(r) : null;
}
export async function saveDog(d: Omit<Dog, "id"> & { id?: number }): Promise<number> {
  await dbReady();
  const vals = [d.name.trim(), d.breed || null, d.birth || null, d.weight ?? null, d.sex, d.neutered == null ? null : d.neutered ? 1 : 0, d.photo || null] as const;
  if (d.id) {
    await db.runAsync("UPDATE dogs SET name = ?, breed = ?, birth = ?, weight = ?, sex = ?, neutered = ?, photo = ? WHERE id = ?", ...vals, d.id);
    await rescheduleDog(d.id);   // the name is in the notification text
    return d.id;
  }
  const r = await db.runAsync("INSERT INTO dogs (name, breed, birth, weight, sex, neutered, photo) VALUES (?, ?, ?, ?, ?, ?, ?)", ...vals);
  return r.lastInsertRowId;
}
export async function deleteDog(id: number): Promise<void> {
  for (const r of await listReminders(id)) if (r.notifId) await Notifications.cancelScheduledNotificationAsync(r.notifId).catch(() => undefined);
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM reminders WHERE dog_id = ?", id);
    await db.runAsync("DELETE FROM chats WHERE dog_id = ?", id);
    await db.runAsync("DELETE FROM dogs WHERE id = ?", id);
  });
}

export async function listReminders(dogId: number): Promise<Reminder[]> {
  await dbReady();
  return (await db.getAllAsync("SELECT * FROM reminders WHERE dog_id = ?", dogId)).map(rowToReminder);
}

// ---- notifications ----
type Texts = { title: (dog: Dog, kind: ReminderKind) => string; body: (dog: Dog, kind: ReminderKind) => string };
let texts: Texts = { title: (d) => d.name, body: (d, k) => k };
/** The UI passes its translations, so notifications use the app's language. */
export function setReminderTexts(t: Texts) { texts = t; }

export async function notificationsAllowed(ask: boolean): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", { name: "Care reminders", importance: Notifications.AndroidImportance.DEFAULT });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted || !ask) return cur.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function schedule(dog: Dog, kind: ReminderKind, due: string | null): Promise<string | null> {
  if (!due) return null;
  const at = new Date(due + "T10:00:00");
  if (at.getTime() <= Date.now() + 60 * 1000) return null;   // past or overdue: shown in the app instead
  if (!(await notificationsAllowed(false))) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: texts.title(dog, kind), body: texts.body(dog, kind), data: { url: `/dog/${dog.id}` } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: "reminders" }
  });
}

/** Sets (or clears, with due = null) a reminder and (re)schedules its notification. */
export async function setReminder(dogId: number, kind: ReminderKind, due: string | null): Promise<void> {
  await dbReady();
  const dog = await getDog(dogId);
  if (!dog) return;
  const def = REMINDER_KINDS.find((k) => k.kind === kind)!;
  const existing = (await listReminders(dogId)).find((r) => r.kind === kind);
  if (existing && existing.notifId) await Notifications.cancelScheduledNotificationAsync(existing.notifId).catch(() => undefined);
  if (!due) { await db.runAsync("DELETE FROM reminders WHERE dog_id = ? AND kind = ?", dogId, kind); return; }
  const notifId = await schedule(dog, kind, due).catch(() => null);
  await db.runAsync(
    "INSERT INTO reminders (dog_id, kind, due, every_months, notif_id) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(dog_id, kind) DO UPDATE SET due = excluded.due, notif_id = excluded.notif_id",
    dogId, kind, due, existing ? existing.everyMonths : def.everyMonths, notifId);
}

/** "Done today": the next one is due one interval from today. */
export async function markDone(r: Reminder): Promise<void> {
  await setReminder(r.dogId, r.kind, addMonths(today(), r.everyMonths));
}

/** After a language or name change, or a fresh permission grant. */
export async function rescheduleDog(dogId: number): Promise<void> {
  for (const r of await listReminders(dogId)) await setReminder(dogId, r.kind, r.due);
}
export async function rescheduleAll(): Promise<void> {
  for (const d of await listDogs()) await rescheduleDog(d.id);
}
