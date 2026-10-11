// Place data: the same prebuilt 0.25-degree cells and chains.json the website
// reads, with every cell kept in SQLite. Network first; when offline (or the
// download fails) the stored copy is used, whatever its age. Cells around home
// are "pinned" so the cache trim never removes them.
import { CONFIG } from "./config";
import { db, dbReady, kvGetJson, kvSetJson } from "./db";
import { classify, type Category } from "../core/classify";
import { detect, type ChainRef } from "../core/chains";
import { evaluate, tzFor } from "../core/hours";

export interface Place {
  id: string;
  name: string | null;
  cat: Category;
  lat: number;
  lon: number;
  cc: string | null;
  chain: string | null;
  chainVia: string | null;
  address: string;
  website: string | null;
  phone: string | null;
  hours: string | null;
  // From the clinic's own website (snuffel-data tools/scan-hours.js), when OSM has no hours.
  // Optional: places saved by an older version don't have them.
  hoursFromSite?: boolean;
  emergency?: "24/7" | "on_call" | null;
  emergencyPhone?: string | null;
  dist: number;          // km from the search centre
  openNow: boolean | null;
  is247: boolean;
}

interface Element { id: string; lat: number; lon: number; cc?: string; tags: Record<string, string> }
interface Manifest { version: string; cell: number; path: string; cells: string[]; cellSet?: Set<string> }

export const CATEGORY_ORDER: Category[] = ["vet", "hospital", "grooming", "shop", "boarding", "training", "play", "shelter"];
export const CATEGORIES: Record<Category, { icon: string; color: string; key: string }> = {
  vet: { icon: "🩺", color: "#2563eb", key: "cat_vet" },
  hospital: { icon: "🏥", color: "#dc2626", key: "cat_hospital" },
  grooming: { icon: "✂️", color: "#db2777", key: "cat_grooming" },
  shop: { icon: "🛍️", color: "#f59e0b", key: "cat_shop" },
  boarding: { icon: "🏨", color: "#7c3aed", key: "cat_boarding" },
  training: { icon: "🎓", color: "#0f766e", key: "cat_training" },
  play: { icon: "🎾", color: "#16a34a", key: "cat_play" },
  shelter: { icon: "🐾", color: "#0891b2", key: "cat_shelter" }
};
// Parks and shelters are often run by a municipality, which isn't a chain.
const COMMERCIAL: Partial<Record<Category, boolean>> = { vet: true, hospital: true, grooming: true, shop: true, boarding: true, training: true };

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_CELLS = 400;   // unpinned; ~10-50 KB each

async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return (await r.json()) as T;
  } finally { clearTimeout(timer); }
}

// ---- manifest and chain reference (refreshed at most daily, else stored) ----
let manifestP: Promise<Manifest | null> | null = null;
export let offline = false;

async function cachedDaily<T>(key: string, url: string): Promise<T | null> {
  const stored = await kvGetJson<{ at: number; v: T }>(key);
  if (stored && Date.now() - stored.at < DAY_MS) return stored.v;
  try {
    const v = await fetchJson<T>(url);
    await kvSetJson(key, { at: Date.now(), v });
    offline = false;
    return v;
  } catch {
    offline = true;
    return stored ? stored.v : null;
  }
}

function manifest(): Promise<Manifest | null> {
  if (!manifestP) {
    manifestP = cachedDaily<Manifest>("manifest", CONFIG.dataBase + "places/manifest.json").then((m) => {
      if (m) m.cellSet = new Set(m.cells);
      else manifestP = null;   // try again next time
      return m;
    });
  }
  return manifestP;
}
let chainRefP: Promise<ChainRef | null> | null = null;
function chainRef(): Promise<ChainRef | null> {
  if (!chainRefP) chainRefP = cachedDaily<ChainRef>("chains", CONFIG.dataBase + "chains.json");
  return chainRefP;
}

// ---- cells ----
async function cell(m: Manifest, id: string, pin = false): Promise<Element[]> {
  await dbReady();
  const row = await db.getFirstAsync<{ version: string; body: string }>("SELECT version, body FROM cells WHERE id = ?", id);
  if (row && row.version === m.version) {
    if (pin) await db.runAsync("UPDATE cells SET pinned = 1 WHERE id = ?", id);
    return JSON.parse(row.body);
  }
  try {
    const els = await fetchJson<Element[]>(CONFIG.dataBase + m.path + id + ".json");
    await db.runAsync(
      "INSERT INTO cells (id, version, body, fetched, pinned) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET version = excluded.version, body = excluded.body, fetched = excluded.fetched, pinned = MAX(cells.pinned, excluded.pinned)",
      id, m.version, JSON.stringify(els), Date.now(), pin ? 1 : 0);
    offline = false;
    return els;
  } catch (e) {
    offline = true;
    if (row) return JSON.parse(row.body);   // older data beats no data
    throw e;
  }
}

async function trimCache(): Promise<void> {
  await db.runAsync(
    "DELETE FROM cells WHERE pinned = 0 AND id NOT IN (SELECT id FROM cells WHERE pinned = 0 ORDER BY fetched DESC LIMIT ?)",
    MAX_CACHED_CELLS);
}

function cellIds(m: Manifest, lat: number, lon: number, radiusM: number): string[] {
  const size = m.cell, ids: string[] = [];
  const dLat = radiusM / 111320, dLon = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
  for (let i = Math.floor((lat - dLat) / size); i <= Math.floor((lat + dLat) / size); i++) {
    for (let j = Math.floor((lon - dLon) / size); j <= Math.floor((lon + dLon) / size); j++) {
      if (m.cellSet!.has(i + "_" + j)) ids.push(i + "_" + j);
    }
  }
  return ids;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---- normalisation (same rules as the website's normalize()) ----
const first = (v?: string) => (v ? v.split(";")[0].trim() || null : null);
function address(tags: Record<string, string>): string {
  const parts: string[] = [];
  const street = tags["addr:street"];
  if (street) parts.push(tags["addr:housenumber"] ? street + " " + tags["addr:housenumber"] : street);
  const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"];
  if (tags["addr:postcode"] || city) parts.push([tags["addr:postcode"], city].filter(Boolean).join(" "));
  return parts.join(", ");
}

export function refreshOpenState<T extends Place>(places: T[]): T[] {
  for (const p of places) {
    const oh = evaluate(p.hours, null, tzFor(p.cc, p.lat, p.lon));
    p.is247 = !!(oh && oh.always);
    p.openNow = oh ? (oh.always ? true : oh.open) : null;
  }
  return places;
}

function normalize(els: Element[], ref: ChainRef | null, lat: number, lon: number): Place[] {
  const out: Place[] = [], seen = new Set<string>();
  for (const el of els) {
    const tags = el.tags || {};
    const cat = classify(tags);
    if (!cat) continue;
    const name = tags.name || (COMMERCIAL[cat] ? tags.brand || tags.operator : null) || null;
    const key = (name || "?") + "@" + el.lat.toFixed(4) + "," + el.lon.toFixed(4);
    if (seen.has(key)) continue;
    seen.add(key);
    const chain = COMMERCIAL[cat] ? detect(tags, ref, el.id) : null;
    out.push({
      id: el.id, name, cat, lat: el.lat, lon: el.lon, cc: el.cc || null,
      chain: chain ? chain.group : null, chainVia: chain ? chain.via : null,
      address: address(tags),
      website: first(tags.website || tags["contact:website"] || tags.url),
      phone: first(tags.phone || tags["contact:phone"]),
      hours: tags.opening_hours || tags["snuffel:opening_hours"] || null,
      hoursFromSite: !tags.opening_hours && !!tags["snuffel:opening_hours"],
      emergency: tags["snuffel:emergency"] === "24/7" || tags["snuffel:emergency"] === "on_call" ? tags["snuffel:emergency"] : null,
      emergencyPhone: tags["snuffel:emergency_phone"] || null,
      dist: haversineKm(lat, lon, el.lat, el.lon), openNow: null, is247: false
    });
  }
  out.sort((a, b) => a.dist - b.dist);
  return refreshOpenState(out);
}

// ---- public API ----
export class NotCoveredError extends Error {}

/** Places within radiusM of a point, nearest first. */
export async function search(lat: number, lon: number, radiusM: number, opts: { pin?: boolean } = {}): Promise<Place[]> {
  const m = await manifest();
  if (!m) throw new Error("no manifest");
  if (!m.cellSet!.has(Math.floor(lat / m.cell) + "_" + Math.floor(lon / m.cell))) throw new NotCoveredError();
  const ids = cellIds(m, lat, lon, radiusM);
  const [ref, cells] = await Promise.all([chainRef(), Promise.all(ids.map((id) => cell(m, id, opts.pin).catch(() => [] as Element[])))]);
  trimCache().catch(() => undefined);
  const km = radiusM / 1000;
  return normalize(cells.flat().filter((el) => haversineKm(lat, lon, el.lat, el.lon) <= km), ref, lat, lon);
}

/**
 * Emergency: vets and hospitals that are not known to be closed, widening the
 * radius until at least 5 are found and at least one of them is known to be
 * open (as the website does): clinics with unknown hours nearby must not hide
 * an open emergency clinic a little further away. Open places first (and
 * clinics with their own 24/7 emergency service), then unknown hours, then
 * closed clinics whose phone line reaches the on-call vet; within each,
 * independents before chains, then distance.
 */
export const emergencyRank = (p: Place) => (p.openNow === true || p.is247 || p.emergency === "24/7" ? 0 : p.openNow == null ? 1 : 2);

export async function emergency(lat: number, lon: number): Promise<{ places: Place[]; radiusM: number }> {
  let last: Place[] = [], radiusM = CONFIG.emergencySteps[0];
  const rank = emergencyRank;
  for (const r of CONFIG.emergencySteps) {
    radiusM = r;
    last = (await search(lat, lon, r)).filter((p) => (p.cat === "vet" || p.cat === "hospital") && (p.openNow !== false || !!p.emergency));
    if (last.length >= 5 && last.some((p) => rank(p) === 0)) break;
  }
  last.sort((a, b) => rank(a) - rank(b) || (a.chain ? 1 : 0) - (b.chain ? 1 : 0) || a.dist - b.dist);
  return { places: last, radiusM };
}

/** Keeps the cells around home on the phone (pinned), for use without signal. */
export async function pinHomeArea(lat: number, lon: number): Promise<number> {
  await dbReady();
  await db.runAsync("UPDATE cells SET pinned = 0");
  const places = await search(lat, lon, CONFIG.homeRadiusM, { pin: true });
  await kvSetJson("home", { lat, lon, at: Date.now() });
  return places.length;
}

/** One place by id, from the cells around a known position (for links and saved places). */
export async function placeById(id: string, lat: number, lon: number): Promise<Place | null> {
  const list = await search(lat, lon, 500).catch(() => [] as Place[]);
  return list.find((p) => p.id === id) || null;
}
