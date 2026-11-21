// What Find lists, and in which order: the chosen categories, "Independents only"
// and "Open now". Types only from the app, so tests/findlist.test.ts runs it in plain
// Node; Find hands in the status of each place (hoursNow, on the place's clock).
//
// "Open now" hides only places whose hours say for sure that they are closed now
// (hourstext.ts never turns "unknown" into "closed"). Known-open places come first,
// then those whose hours are unknown (half the vets, nearly every park and dog
// field), nearest first in each: hiding those could hide the only open vet.
//
// With "Independents only", an open chain-owned place is shown for every category
// in which no independent place is known to be open: an open shop must not hide the
// only open (chain) vet. Chains with unknown hours stay hidden then, unless nothing
// else is left at all (as without "Open now": only chains nearby).
import type { Category } from "../core/classify";
import type { Status } from "./hourstext";

export interface Listable {
  id: string;
  cat: Category;
  chain: string | null;
  emergency?: "24/7" | "on_call" | null;
}

export type Openness = "open" | "unknown" | "closed";

/** Open by its hours (or 24/7), or a clinic with its own 24/7 emergency service; closed only when the hours say so. */
export function openness(p: Listable, s: Status): Openness {
  if (s.kind === "open" || s.kind === "always" || p.emergency === "24/7") return "open";
  return s.kind === "closed" ? "closed" : "unknown";
}

export type Row<T> =
  | { kind: "place"; p: T }
  | { kind: "heading"; text: "chains" | "openNow" | "hoursUnknown" }
  | { kind: "note"; text: "chainOnly" | "openChains" | "noneOpen" }
  | { kind: "widen" }                       // "Search further: 5 km"
  | { kind: "showClosed"; n: number }       // "Also show closed places (6)": turns "Open now" off
  | { kind: "emergency" };                  // "Find an open vet now": the Emergency tab

export interface FindList<T> {
  rows: Row<T>[];
  shown: T[];       // every place listed, in list order (the map and the count)
  open: number;     // with "Open now": listed places known to be open
  unknown: number;  // with "Open now": listed places whose hours are unknown
  closed: number;   // with "Open now": closed places it hides (the list would show them without it)
}

export interface FindOptions<T> {
  cats: Record<Category, boolean>;
  independentOnly: boolean;
  openOnly: boolean;
  /** The place's opening state now; read once per place, at one moment for the whole list. */
  status: (p: T) => Status;
  /** A larger radius exists. */
  canWiden: boolean;
}

const place = <T,>(p: T): Row<T> => ({ kind: "place", p });

/**
 * Without "Open now": independents, then chains when they're wanted or, with
 * "Independents only", the chains of every category without an independent place
 * nearby (per category, as with "Open now": an independent shop must not hide the
 * only vets, chain-owned ones). The website (web/js/app.js) does the same.
 */
function plain<T extends Listable>(inCats: T[], o: FindOptions<T>): { rows: Row<T>[]; shown: T[] } {
  const independents = inCats.filter((p) => !p.chain);
  const kinds = new Set(independents.map((p) => p.cat));
  const chains = inCats.filter((p) => p.chain && (!o.independentOnly || !kinds.has(p.cat)));
  const rows = independents.map(place);
  if (chains.length) {
    if (o.independentOnly) {
      // Only chains for some categories: say so, offer a wider search, and show them below.
      rows.push({ kind: "note", text: "chainOnly" });
      if (o.canWiden) rows.push({ kind: "widen" });
    } else if (independents.length) rows.push({ kind: "heading", text: "chains" });
    rows.push(...chains.map(place));
  }
  return { rows, shown: independents.concat(chains) };
}

/** The rows of Find's list (places nearest first in, nearest first out within each group). */
export function findList<T extends Listable>(places: T[], o: FindOptions<T>): FindList<T> {
  const inCats = places.filter((p) => o.cats[p.cat]);
  const base = plain(inCats, o);
  if (!o.openOnly) return { ...base, open: 0, unknown: 0, closed: 0 };

  const state = new Map<T, Openness>();
  for (const p of inCats) state.set(p, openness(p, o.status(p)));
  const pick = (s: Openness, chain: boolean) => inCats.filter((p) => state.get(p) === s && !!p.chain === chain);
  const openI = pick("open", false), openC = pick("open", true);
  const unknownI = pick("unknown", false), unknownC = pick("unknown", true);

  // Open chains: where no independent of the same kind is known to be open.
  const openKinds = new Set(openI.map((p) => p.cat));
  const openChains = o.independentOnly ? openC.filter((p) => !openKinds.has(p.cat)) : openC;
  const onlyChains = !openI.length && !unknownI.length && !openChains.length;
  const unknownChains = !o.independentOnly || onlyChains ? unknownC : [];

  const open = openI.concat(openChains), unknown = unknownI.concat(unknownChains);
  const closed = base.shown.filter((p) => state.get(p) === "closed").length;
  const rows: Row<T>[] = [];

  if (!open.length && !unknown.length) {
    // Nothing open: say so and offer the ways on (without closed ones there was nothing at all: the plain empty list).
    if (closed) {
      rows.push({ kind: "note", text: "noneOpen" });
      if (o.canWiden) rows.push({ kind: "widen" });
      rows.push({ kind: "showClosed", n: closed });
      if (o.cats.vet || o.cats.hospital) rows.push({ kind: "emergency" });
    }
    return { rows, shown: [], open: 0, unknown: 0, closed };
  }

  if (open.length && unknown.length) rows.push({ kind: "heading", text: "openNow" });
  rows.push(...openI.map(place));
  if (openChains.length) {
    if (o.independentOnly) {
      rows.push({ kind: "note", text: "openChains" });
      if (!openI.length && o.canWiden) rows.push({ kind: "widen" });
    }
    rows.push(...openChains.map(place));
  }
  if (unknown.length) {
    rows.push({ kind: "heading", text: "hoursUnknown" });
    rows.push(...unknownI.map(place));
    if (unknownChains.length && o.independentOnly) {
      rows.push({ kind: "note", text: "chainOnly" });
      if (o.canWiden) rows.push({ kind: "widen" });
    }
    rows.push(...unknownChains.map(place));
  }
  if (closed) rows.push({ kind: "showClosed", n: closed });
  return { rows, shown: open.concat(unknown), open: open.length, unknown: unknown.length, closed };
}
