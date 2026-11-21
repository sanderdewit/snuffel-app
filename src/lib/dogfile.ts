// The dog's health & behaviour file: vet visits, diagnoses, medication,
// allergies, weight, behaviour notes and saved AI advice. Stored on the phone;
// a short summary can go along with AI questions (per dog, on/off).
// Export: a PDF (for the vet) and a data file for another phone, optionally
// protected with a password (see seal.ts).
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { db, dbReady } from "./db";
import { getDog, listReminders, saveDog, setReminder, validDate, type Dog, type ReminderKind } from "./dogs";
import { RECORD_KINDS, recurring, signCategory, summarise, type DogRecord, type RecordKind, type SignCategory } from "./dogsummary";
import { acceptedParams, b64, imageType, seal, unseal, WrongPasswordError, type Sealed } from "./seal";
import { breedForServer, breedLabel, breeds, cleanChoice, matchFreeText } from "./breeds";

export { RECORD_KINDS, recurring, summarise, type DogRecord, type RecordKind, type SignCategory };
export { IMPORT_MAX_BYTES, PASSWORD_MIN, PasswordTooShortError } from "./seal";

const toRecord = (r: any): DogRecord => ({ id: r.id, dogId: r.dog_id, kind: r.kind, date: r.date, title: r.title, details: r.details, value: r.value,
  category: r.category ? signCategory(r.category) : null });

export async function listRecords(dogId: number): Promise<DogRecord[]> {
  await dbReady();
  return (await db.getAllAsync("SELECT * FROM records WHERE dog_id = ? ORDER BY date DESC, id DESC", dogId)).map(toRecord);
}

export async function addRecord(r: Omit<DogRecord, "id">): Promise<number> {
  await dbReady();
  const res = await db.runAsync("INSERT INTO records (dog_id, kind, date, title, details, value, created, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    r.dogId, r.kind, r.date, r.title.trim().slice(0, 200), r.details ? r.details.trim().slice(0, 4000) : null, r.value, Date.now(),
    r.kind === "symptom" ? signCategory(r.category) : null);
  if (r.kind === "weight" && r.value) await syncWeight(r.dogId);
  return res.lastInsertRowId;
}

/** A sign noted by the AI chat, as it comes back from the server. */
export interface Observation { date: string; category: SignCategory; title: string; details: string }

// Follow-up answers about the same sign refine one entry instead of adding new ones:
// an entry of the same category filed from the chat in the last 12 hours is updated.
const SAME_EPISODE_MS = 12 * 3600 * 1000;
/** Files an observation for the dog; returns the entry's id. */
export async function fileObservation(dogId: number, o: Observation): Promise<number> {
  await dbReady();
  const recent = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM records WHERE dog_id = ? AND kind = 'symptom' AND category = ? AND created > ? ORDER BY id DESC",
    dogId, signCategory(o.category), Date.now() - SAME_EPISODE_MS);
  if (recent) {
    await db.runAsync("UPDATE records SET date = ?, title = ?, details = ? WHERE id = ?",
      o.date, o.title.trim().slice(0, 200), o.details.trim().slice(0, 4000) || null, recent.id);
    return recent.id;
  }
  return addRecord({ dogId, kind: "symptom", date: o.date, title: o.title, details: o.details || null, value: null, category: o.category });
}

export async function deleteRecordById(id: number): Promise<void> {
  await dbReady();
  await db.runAsync("DELETE FROM records WHERE id = ? AND kind = 'symptom'", id);
}

/** Whether the AI chat files observed signs in this dog's file by itself (default on). */
export async function autoFile(dogId: number): Promise<boolean> {
  await dbReady();
  const r = await db.getFirstAsync<{ auto_file: number }>("SELECT auto_file FROM dogs WHERE id = ?", dogId);
  return !r || !!r.auto_file;
}
export async function setAutoFile(dogId: number, on: boolean): Promise<void> {
  await dbReady();
  await db.runAsync("UPDATE dogs SET auto_file = ? WHERE id = ?", on ? 1 : 0, dogId);
}

// The latest weight entry keeps the profile's weight current.
async function syncWeight(dogId: number) {
  const latest = await db.getFirstAsync<{ value: number }>(
    "SELECT value FROM records WHERE dog_id = ? AND kind = 'weight' AND value IS NOT NULL ORDER BY date DESC, id DESC", dogId);
  if (latest) await db.runAsync("UPDATE dogs SET weight = ? WHERE id = ?", latest.value, dogId);
}

export async function deleteRecord(r: DogRecord): Promise<void> {
  await dbReady();
  await db.runAsync("DELETE FROM records WHERE id = ?", r.id);
  if (r.kind === "weight") await syncWeight(r.dogId);
}

export async function shareFileWithAi(dogId: number): Promise<boolean> {
  await dbReady();
  const r = await db.getFirstAsync<{ share_file: number }>("SELECT share_file FROM dogs WHERE id = ?", dogId);
  return !r || !!r.share_file;
}
export async function setShareFileWithAi(dogId: number, on: boolean): Promise<void> {
  await dbReady();
  await db.runAsync("UPDATE dogs SET share_file = ? WHERE id = ?", on ? 1 : 0, dogId);
}

export async function aiSummary(dogId: number): Promise<string | null> {
  if (!(await shareFileWithAi(dogId))) return null;
  return summarise(await listRecords(dogId));
}

// ---- export / import ----
interface ExportV1 {
  format: "snuffel-dog"; version: 1; exported: string;
  dog: Omit<Dog, "id" | "photo"> & { photoJpegBase64?: string | null };
  records: Omit<DogRecord, "id" | "dogId">[];
  reminders: { kind: ReminderKind; due: string | null }[];
}

const safeName = (s: string) => (typeof s.normalize === "function" ? s.normalize("NFD") : s).replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40) || "dog";

async function buildExport(dogId: number): Promise<ExportV1> {
  const dog = await getDog(dogId);
  if (!dog) throw new Error("no dog");
  let photo: string | null = null;
  if (dog.photo) { try { photo = await new File(dog.photo).base64(); } catch { photo = null; } }
  const { id: _id, photo: _p, ...rest } = dog;
  return {
    format: "snuffel-dog", version: 1, exported: new Date().toISOString(),
    // breed: also the English name, for apps from before the breed picker (they only read this)
    dog: { ...rest, breed: rest.breed ?? breedForServer(breeds(), rest).breed ?? null, photoJpegBase64: photo },
    records: (await listRecords(dogId)).map(({ id: _i, dogId: _d, ...r }) => r),
    reminders: (await listReminders(dogId)).map((r) => ({ kind: r.kind, due: r.due }))
  };
}

async function shareText(name: string, body: string | Uint8Array, mimeType: string, UTI: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(body);
  return Sharing.shareAsync(file.uri, { mimeType, UTI });
}

/** Data file for another phone; with a password (PASSWORD_MIN or more, else PasswordTooShortError) it is encrypted. Opens the share sheet. */
export async function exportData(dogId: number, password: string | null): Promise<void> {
  const data = await buildExport(dogId);
  const plain = JSON.stringify(data);
  const body = password ? JSON.stringify(await seal(plain, password, (n) => Crypto.getRandomBytes(n))) : plain;
  await shareText(`snuffel-${safeName(data.dog.name)}.json`, body, "application/json", "public.json");
}

export class NeedsPasswordError extends Error {}
export class BadFileError extends Error {}

/** Adds the dog from an export as a new dog. Throws NeedsPasswordError (no or wrong password) or BadFileError. */
export async function importData(text: string, password: string | null): Promise<string> {
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { throw new BadFileError(); }
  if (parsed && parsed.format === "snuffel-dog-encrypted") {
    if (!acceptedParams(parsed)) throw new BadFileError();   // before asking for a password
    if (!password) throw new NeedsPasswordError();
    try { parsed = JSON.parse(await unseal(parsed as Sealed, password)); }
    catch (e) { throw e instanceof WrongPasswordError ? new NeedsPasswordError() : new BadFileError(); }
  }
  const d = parsed as ExportV1;
  if (!d || d.format !== "snuffel-dog" || d.version !== 1 || !d.dog || typeof d.dog.name !== "string") throw new BadFileError();
  let photo: string | null = null;
  if (typeof d.dog.photoJpegBase64 === "string" && d.dog.photoJpegBase64.length < 8_000_000) {
    // Only a real JPEG or PNG is kept; anything else is dropped, the rest of the dog still comes in.
    try {
      const bytes = b64.dec(d.dog.photoJpegBase64), type = imageType(bytes);
      if (type) { const f = new File(Paths.document, `dog-${Date.now()}.${type}`); f.create(); await f.write(bytes); photo = f.uri; }
    } catch { photo = null; }
  }
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && v >= lo && v <= hi ? v : null);
  // breedId and the rest since 1.0.3; an older file's free text is matched like an old profile
  const breed = d.dog.breedId ? cleanChoice(breeds(), { breedId: str(d.dog.breedId, 60), breed: str(d.dog.breed, 40), breedSize: d.dog.breedSize,
    breedMix: Array.isArray(d.dog.breedMix) ? d.dog.breedMix.filter((m: unknown): m is string => typeof m === "string") : [] })
    : matchFreeText(breeds(), str(d.dog.breed, 40)) || cleanChoice(breeds(), {});
  const dogId = await saveDog({
    name: str(d.dog.name, 40) || "?", ...breed, birth: d.dog.birth && validDate(d.dog.birth) ? d.dog.birth : null,
    weight: num(d.dog.weight, 0.3, 150), sex: d.dog.sex === "male" || d.dog.sex === "female" ? d.dog.sex : null,
    neutered: typeof d.dog.neutered === "boolean" ? d.dog.neutered : null, photo
  });
  const kinds = new Set(RECORD_KINDS.map((k) => k.kind));
  for (const r of Array.isArray(d.records) ? d.records.slice(0, 2000) : []) {
    if (!r || !kinds.has(r.kind) || !validDate(String(r.date)) || typeof r.title !== "string") continue;
    await addRecord({ dogId, kind: r.kind, date: r.date, title: r.title, details: str(r.details, 4000), value: num(r.value, 0.3, 150), category: r.category ?? null });
  }
  for (const r of Array.isArray(d.reminders) ? d.reminders : []) {
    if (r && ["vaccination", "deworming", "flea_tick", "checkup"].includes(r.kind) && r.due && validDate(r.due)) await setReminder(dogId, r.kind, r.due);
  }
  return d.dog.name.slice(0, 40);
}

// ---- PDF ----
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export async function exportPdf(dogId: number, t: (k: string) => string, tf: (k: string, v: Record<string, string | number>) => string, lang = "en"): Promise<void> {
  const dog = await getDog(dogId);
  if (!dog) return;
  const records = await listRecords(dogId);
  const reminders = (await listReminders(dogId)).filter((r) => r.due);
  let photo = "";
  if (dog.photo) { try { photo = `<img src="data:image/${dog.photo.endsWith(".png") ? "png" : "jpeg"};base64,${await new File(dog.photo).base64()}" />`; } catch { /* no photo */ } }
  const kindName = (k: RecordKind) => t(RECORD_KINDS.find((x) => x.kind === k)!.key);
  const kindLabel = (k: RecordKind, c?: SignCategory | null) => kindName(k) + (k === "symptom" && c ? " · " + t("app_sign_" + c) : "");
  // Signs that came back, on top: what the vet should see first.
  const again = recurring(records);
  const facts = [
    (dog.breedId || dog.breed) && [t("app_breed"), breedLabel(breeds(), dog, lang, t, tf)], dog.birth && [t("app_born"), dog.birth],
    dog.weight && [t("app_weight"), dog.weight + " kg"],
    dog.sex && [t("app_sex"), t(dog.sex === "male" ? "app_male" : "app_female") + (dog.neutered ? ", " + t("app_neutered").toLowerCase() : "")]
  ].filter(Boolean) as string[][];
  // Paper is white: always light, also when the app is dark (fixed colours, "only light").
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="only light"><style>
    html, body { background: #fff; }
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 32px; font-size: 12pt; }
    h1 { font-size: 20pt; margin: 0 0 4px; } h2 { font-size: 13pt; margin: 22px 0 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
    .head { display: flex; gap: 18px; align-items: center; } img { width: 90px; height: 90px; border-radius: 45px; object-fit: cover; }
    table { border-collapse: collapse; width: 100%; } td { padding: 5px 6px; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
    td.d { white-space: nowrap; width: 90px; color: #475569; } td.k { width: 120px; color: #475569; } .muted { color: #64748b; font-size: 10pt; }
  </style></head><body>
    <div class="head">${photo}<div><h1>${esc(tf("app_pdfTitle", { name: dog.name }))}</h1>
      ${facts.map(([k, v]) => `<div>${esc(k)}: <b>${esc(String(v))}</b></div>`).join("")}</div></div>
    ${reminders.length ? `<h2>${esc(t("app_reminders"))}</h2><table>${reminders.map((r) => `<tr><td class="d">${esc(String(r.due))}</td><td>${esc(t("app_rem_" + r.kind))}</td></tr>`).join("")}</table>` : ""}
    ${again.length ? `<h2>${esc(t("app_recurring"))}</h2><table>${again.map((g) => `<tr><td class="k">${esc(t("app_sign_" + g.category))}</td><td>${esc(tf("app_recurringTimes", { n: g.dates.length }))}: ${g.dates.map(esc).join(", ")}</td></tr>`).join("")}</table>` : ""}
    <h2>${esc(t("app_dogFile"))}</h2>
    ${records.length ? `<table>${records.map((r) => `<tr><td class="d">${esc(r.date)}</td><td class="k">${esc(kindLabel(r.kind, r.category))}</td><td><b>${esc(r.title)}</b>${r.value ? ` ${esc(String(r.value))} kg` : ""}${r.details ? `<br>${esc(r.details).replace(/\n/g, "<br>")}` : ""}</td></tr>`).join("")}</table>` : `<p class="muted">${esc(t("app_noEntries"))}</p>`}
    <p class="muted" style="margin-top:28px">${esc(tf("app_pdfGenerated", { date: new Date().toISOString().slice(0, 10) }))}</p>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  const dest = new File(Paths.cache, `snuffel-${safeName(dog.name)}.pdf`);
  if (dest.exists) dest.delete();
  new File(uri).move(dest);
  await Sharing.shareAsync(dest.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
}
