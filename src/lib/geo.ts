// Address search (OpenStreetMap Nominatim, Europe only) and the phone's location.
import * as Location from "expo-location";
import { CONFIG } from "./config";

export interface Spot { lat: number; lon: number; label: string }

// Nominatim's policy: max 1 request/s, identifying User-Agent, no autocomplete.
let lastCall = 0;
async function nominatim(path: string): Promise<any> {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const r = await fetch(CONFIG.nominatim + path, { headers: { "User-Agent": CONFIG.userAgent, Accept: "application/json" } });
  if (!r.ok) throw new Error("nominatim " + r.status);
  return r.json();
}

export async function geocode(query: string, lang: string): Promise<Spot | null> {
  const data = await nominatim(`/search?format=jsonv2&limit=1&countrycodes=${CONFIG.countryCodes}` +
    `&accept-language=${encodeURIComponent(lang)}&q=${encodeURIComponent(query)}`);
  if (!Array.isArray(data) || !data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name };
}

export async function reverseLabel(lat: number, lon: number, lang: string): Promise<string> {
  try {
    const d = await nominatim(`/reverse?format=jsonv2&zoom=16&accept-language=${encodeURIComponent(lang)}&lat=${lat}&lon=${lon}`);
    return (d && d.display_name) || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch { return `${lat.toFixed(4)}, ${lon.toFixed(4)}`; }
}

export class LocationDeniedError extends Error {}

/** Current position: a recent last-known fix first (instant), else a fresh one. */
export async function currentPosition(): Promise<{ lat: number; lon: number }> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") throw new LocationDeniedError();
  const last = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 500 });
  if (last) return { lat: last.coords.latitude, lon: last.coords.longitude };
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude };
}

export const shortLabel = (label: string) => label.split(",").slice(0, 2).join(",").trim();
