// Lost or found dog: first steps, the official registers per country, and the
// local search groups (snuffel-data/lost/groups.json, published as
// snuffel.app/data/lost-groups.json). Same content as the website's guide
// (web/js/app.js, LOST_LINKS / LOST_STEPS). Links only: nothing is sent to them.
import * as Location from "expo-location";
import { getLocales } from "expo-localization";
import { CONFIG } from "./config";

export type LostMode = "lost" | "found";
export type LostCountry = "NL" | "BE" | "DE" | "FR" | "EU";
type LinkKind = "lost" | "found" | "search" | "chip";
export interface LostLink { key: string; url: string }

export const LOST_COUNTRIES: LostCountry[] = ["NL", "BE", "DE", "FR", "EU"];

export const LOST_LINKS: Record<LostCountry, Partial<Record<LinkKind, LostLink>>> = {
  NL: {
    lost:   { key: "lostLinkLost",   url: "https://www.amivedi.nl/dier-aanmelden/?status=vermist" },
    found:  { key: "lostLinkFound",  url: "https://www.amivedi.nl/dier-aanmelden/?status=gevonden" },
    search: { key: "lostLinkSearch", url: "https://www.amivedi.nl/dier-zoeken/" },
    chip:   { key: "lostLinkChip",   url: "https://www.chipnummer.nl/" }
  },
  BE: {
    lost:   { key: "lostLinkLost",   url: "https://www.dogid.be/nl/particulier/hond-vermist" },
    found:  { key: "lostLinkFound",  url: "https://www.dogid.be/nl/particulier/hond-gevonden" },
    chip:   { key: "lostLinkChip",   url: "https://www.dogid.be/nl/verantwoordelijke-zoeken" }
  },
  DE: {
    lost:   { key: "lostLinkLost",   url: "https://www.tasso.net/Tierregister/Tier-vermisst/Tier-vermisst-melden" },
    found:  { key: "lostLinkFound",  url: "https://www.tasso.net/Tierregister/Tier-gefunden" },
    chip:   { key: "lostLinkChip",   url: "https://www.tasso.net/Tierregister/Transponderabfrage" }
  },
  FR: {
    lost:   { key: "lostLinkLost",   url: "https://www.i-cad.fr/articles/animal_perdu" },
    found:  { key: "lostLinkFound",  url: "https://www.i-cad.fr/articles/animal_trouve" },
    chip:   { key: "lostLinkChip",   url: "https://www.i-cad.fr/articles/verifier-identification-dun-animal" }
  },
  EU: {
    chip:   { key: "lostLinkChip",   url: "https://europetnet.org/pet-id-search/" }
  }
};

/** Each step: its text key, the links under it, and an optional button (the emergency tab). */
export const LOST_STEPS: Record<LostMode, { key: string; links?: LinkKind[]; emergency?: boolean }[]> = {
  lost: [{ key: "lostStep1" }, { key: "lostStep2", links: ["lost", "chip"] }, { key: "lostStep3" }, { key: "lostStep4", links: ["search"] }, { key: "lostStep5" }],
  found: [{ key: "foundStep1", emergency: true }, { key: "foundStep2", links: ["chip"] }, { key: "foundStep3", links: ["found", "search"] }, { key: "foundStep4" }]
};

/** The phone's region decides (fr-CH is not France); "EU" when it isn't one of ours. */
export function defaultLostCountry(): LostCountry {
  const region = (getLocales()[0]?.regionCode || "").toUpperCase();
  return (LOST_COUNTRIES as string[]).includes(region) ? (region as LostCountry) : "EU";
}

// The suggestion form under the website's guide (no account needed).
export const LOST_GROUPS_FORM = CONFIG.website + "#lost-suggest";

export interface LostGroup { id: string; name: string; url: string; country: string; region?: string; lat?: number; lon?: number; radiusKm?: number }

let groupsReady: Promise<LostGroup[]> | null = null;
function allGroups(): Promise<LostGroup[]> {
  if (!groupsReady) {
    groupsReady = fetch(CONFIG.dataBase + "lost-groups.json", { cache: "no-cache" } as RequestInit)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && Array.isArray(d.groups) ? (d.groups as LostGroup[]) : []))
      .catch(() => { groupsReady = null; return []; });   // try again next time
  }
  return groupsReady;
}

/** Where the phone was last, only if location access was already given (never asks). */
export async function lastKnownSpot(): Promise<{ lat: number; lon: number } | null> {
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted) return null;
    const p = await Location.getLastKnownPositionAsync({ maxAge: 24 * 60 * 60 * 1000 });
    return p ? { lat: p.coords.latitude, lon: p.coords.longitude } : null;
  } catch { return null; }
}

function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Nationwide groups of the country plus regional ones; with a position, only regional ones around it, nearest first. */
export async function lostGroups(country: LostCountry, here: { lat: number; lon: number } | null): Promise<LostGroup[]> {
  const groups = (await allGroups()).filter((g) => {
    if (country !== "EU" && g.country !== country) return false;
    if (g.lat == null || g.lon == null || g.radiusKm == null) return country !== "EU";
    return here ? km(here.lat, here.lon, g.lat, g.lon) <= g.radiusKm : country !== "EU";
  });
  if (here) {
    const d = (g: LostGroup) => (g.lat == null || g.lon == null ? 1e6 : km(here.lat, here.lon, g.lat, g.lon));
    groups.sort((a, b) => d(a) - d(b));
  }
  return groups.slice(0, 12);
}
