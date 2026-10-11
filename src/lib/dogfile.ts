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
import { RECORD_KINDS, summarise, type DogRecord, type RecordKind } from "./dogsummary";
import { b64, seal, unseal, WrongPasswordError, type Sealed } from "./seal";

export { RECORD_KINDS, summarise, type DogRecord, type RecordKind };

const toRecord = (r: any): DogRecord => ({ id: r.id, dogId: r.dog_id, kind: r.kind, date: r.date, title: r.title, details: r.details, value: r.value });

export async function listRecords(dogId: number): Promise<DogRecord[]> {
  await dbReady();
  return (await db.getAllAsync("SELECT * FROM records WHERE dog_id = ? ORDER BY date DESC, id DESC", dogId)).map(toRecord);
}

export async function addRecord(r: Omit<DogRecord, "id">): Promise<void> {
  await dbReady();
  await db.runAsync("INSERT INTO records (dog_id, kind, date, title, details, value, created) VALUES (?, ?, ?, ?, ?, ?, ?)",
    r.dogId, r.kind, r.date, r.title.trim().slice(0, 200), r.details ? r.details.trim().slice(0, 4000) : null, r.value, Date.now());
  if (r.kind === "weight" && r.value) await syncWeight(r.dogId);
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

const safeName = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 40) || "dog";

async function buildExport(dogId: number): Promise<ExportV1> {
  const dog = await getDog(dogId);
  if (!dog) throw new Error("no dog");
  let photo: string | null = null;
  if (dog.photo) { try { photo = await new File(dog.photo).base64(); } catch { photo = null; } }
  const { id: _id, photo: _p, ...rest } = dog;
  return {
    format: "snuffel-dog", version: 1, exported: new Date().toISOString(),
    dog: { ...rest, photoJpegBase64: photo },
    records: (await listRecords(dogId)).map(({ id: _i, dogId: _d, ...r }) => r),
    reminders: (await listReminders(dogId)).map((r) => ({ kind: r.kind, due: r.due }))
  };
}

function shareText(name: string, body: string | Uint8Array, mimeType: string, UTI: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(body);
  return Sharing.shareAsync(file.uri, { mimeType, UTI });
}

/** Data file for another phone; with a password it is encrypted. Opens the share sheet. */
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
    if (!password) throw new NeedsPasswordError();
    try { parsed = JSON.parse(await unseal(parsed as Sealed, password)); }
    catch (e) { throw e instanceof WrongPasswordError ? new NeedsPasswordError() : new BadFileError(); }
  }
  const d = parsed as ExportV1;
  if (!d || d.format !== "snuffel-dog" || d.version !== 1 || !d.dog || typeof d.dog.name !== "string") throw new BadFileError();
  let photo: string | null = null;
  if (typeof d.dog.photoJpegBase64 === "string" && d.dog.photoJpegBase64.length < 8_000_000) {
    try { const f = new File(Paths.document, `dog-${Date.now()}.jpg`); f.create(); f.write(b64.dec(d.dog.photoJpegBase64)); photo = f.uri; } catch { photo = null; }
  }
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && v >= lo && v <= hi ? v : null);
  const dogId = await saveDog({
    name: str(d.dog.name, 40) || "?", breed: str(d.dog.breed, 40), birth: d.dog.birth && validDate(d.dog.birth) ? d.dog.birth : null,
    weight: num(d.dog.weight, 0.3, 150), sex: d.dog.sex === "male" || d.dog.sex === "female" ? d.dog.sex : null,
    neutered: typeof d.dog.neutered === "boolean" ? d.dog.neutered : null, photo
  });
  const kinds = new Set(RECORD_KINDS.map((k) => k.kind));
  for (const r of Array.isArray(d.records) ? d.records.slice(0, 2000) : []) {
    if (!r || !kinds.has(r.kind) || !validDate(String(r.date)) || typeof r.title !== "string") continue;
    await addRecord({ dogId, kind: r.kind, date: r.date, title: r.title, details: str(r.details, 4000), value: num(r.value, 0.3, 150) });
  }
  for (const r of Array.isArray(d.reminders) ? d.reminders : []) {
    if (r && ["vaccination", "deworming", "flea_tick", "checkup"].includes(r.kind) && r.due && validDate(r.due)) await setReminder(dogId, r.kind, r.due);
  }
  return d.dog.name.slice(0, 40);
}

// ---- PDF ----
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export async function exportPdf(dogId: number, t: (k: string) => string, tf: (k: string, v: Record<string, string | number>) => string): Promise<void> {
  const dog = await getDog(dogId);
  if (!dog) return;
  const records = await listRecords(dogId);
  const reminders = (await listReminders(dogId)).filter((r) => r.due);
  let photo = "";
  if (dog.photo) { try { photo = `<img src="data:image/jpeg;base64,${await new File(dog.photo).base64()}" />`; } catch { /* no photo */ } }
  const kindLabel = (k: RecordKind) => t(RECORD_KINDS.find((x) => x.kind === k)!.key);
  const facts = [
    dog.breed && [t("app_breed"), dog.breed], dog.birth && [t("app_born"), dog.birth],
    dog.weight && [t("app_weight"), dog.weight + " kg"],
    dog.sex && [t("app_sex"), t(dog.sex === "male" ? "app_male" : "app_female") + (dog.neutered ? ", " + t("app_neutered").toLowerCase() : "")]
  ].filter(Boolean) as string[][];
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 32px; font-size: 12pt; }
    h1 { font-size: 20pt; margin: 0 0 4px; } h2 { font-size: 13pt; margin: 22px 0 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
    .head { display: flex; gap: 18px; align-items: center; } img { width: 90px; height: 90px; border-radius: 45px; object-fit: cover; }
    table { border-collapse: collapse; width: 100%; } td { padding: 5px 6px; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
    td.d { white-space: nowrap; width: 90px; color: #475569; } td.k { width: 120px; color: #475569; } .muted { color: #64748b; font-size: 10pt; }
  </style></head><body>
    <div class="head">${photo}<div><h1>${esc(tf("app_pdfTitle", { name: dog.name }))}</h1>
      ${facts.map(([k, v]) => `<div>${esc(k)}: <b>${esc(String(v))}</b></div>`).join("")}</div></div>
    ${reminders.length ? `<h2>${esc(t("app_reminders"))}</h2><table>${reminders.map((r) => `<tr><td class="d">${r.due}</td><td>${esc(t("app_rem_" + r.kind))}</td></tr>`).join("")}</table>` : ""}
    <h2>${esc(t("app_dogFile"))}</h2>
    ${records.length ? `<table>${records.map((r) => `<tr><td class="d">${r.date}</td><td class="k">${esc(kindLabel(r.kind))}</td><td><b>${esc(r.title)}</b>${r.value ? ` ${r.value} kg` : ""}${r.details ? `<br>${esc(r.details).replace(/\n/g, "<br>")}` : ""}</td></tr>`).join("")}</table>` : `<p class="muted">${esc(t("app_noEntries"))}</p>`}
    <p class="muted" style="margin-top:28px">${esc(tf("app_pdfGenerated", { date: new Date().toISOString().slice(0, 10) }))}</p>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  const dest = new File(Paths.cache, `snuffel-${safeName(dog.name)}.pdf`);
  if (dest.exists) dest.delete();
  new File(uri).move(dest);
  await Sharing.shareAsync(dest.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
}
