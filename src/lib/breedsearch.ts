// The breed list (src/core/breeds.json, a copy of snuffel-data's breeds/breeds.json):
// search for the picker, matching an old free-text breed to an id, and the labels
// shown in the app and sent to the server. No app imports, so tests/breeds.test.ts
// runs it in plain Node; lib/breeds.ts binds it to the bundled list.

export type BreedKind = "breed" | "variety" | "cross" | "mixed" | "other";
export interface Breed {
  id: string;                      // fci-166, fci-15-malinois, x-labradoodle, nf-american-bully, mixed, other
  kind: BreedKind;
  fci?: number;
  of?: string;                     // a variety's breed
  status?: string;                 // "removed": no longer in the sources, still shown for profiles that use it
  rank?: number;                   // common in Europe: shown first, 1 = most common
  names: Record<string, string>;   // all 29 app languages
  aliases: string[];               // other names and misspellings, any language
}
export interface BreedList { breeds: Breed[] }

export type MixSize = "small" | "medium" | "large";
export const MIX_SIZES: MixSize[] = ["small", "medium", "large"];
export const MIX_MAX = 2;   // "mainly" at most two breeds

/** What a profile stores. */
export interface BreedChoice {
  breedId: string | null;
  breed: string | null;        // the owner's own words: "other" (or a profile from before the picker)
  breedSize: MixSize | null;   // mixed only
  breedMix: string[];          // mixed only: mainly these ids
}

// ---------------------------------------------------------------- normalising
const SPECIAL: Record<string, string> = { "ß": "ss", "æ": "ae", "ø": "o", "œ": "oe", "đ": "d", "ł": "l", "ı": "i", "þ": "th", "ð": "d" };
const decompose = (s: string) => { try { return s.normalize("NFD"); } catch { return s; } };
/** Lowercase, no accents or punctuation: "Mäyräkoira" = "mayrakoira", "Shih-Tzu" = "shih tzu". */
export function norm(s: string): string {
  return decompose(String(s || "").toLowerCase()).replace(/[̀-ͯ]/g, "")
    .replace(/[ßæøœđłıþð]/g, (c) => SPECIAL[c]).replace(/[^0-9a-zß-ɏͰ-ϿЀ-ӿ]+/g, " ").trim();
}

/** Edit distance with swapped neighbours counting as one ("labardor" -> "labrador" = 1). */
export function distance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}
const allowed = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

// ---------------------------------------------------------------- index
export interface BreedIndex {
  all: Breed[];                       // without removed ones: what the picker offers
  byId: Map<string, Breed>;           // everything, removed ones too
  terms: Map<string, string[]>;       // id -> normalised names (every language) and aliases
  words: Map<string, Term[]>;         // the same, split once for search
  owners: Map<string, string[]>;      // normalised term -> ids
}
interface Term { t: string; words: string[]; tight: string }

export function makeIndex(list: BreedList): BreedIndex {
  const byId = new Map<string, Breed>(), terms = new Map<string, string[]>(), words = new Map<string, Term[]>(), owners = new Map<string, string[]>();
  for (const b of list.breeds) {
    byId.set(b.id, b);
    const set = new Set<string>();
    for (const t of [...Object.values(b.names), ...b.aliases]) { const k = norm(t); if (k) set.add(k); }
    terms.set(b.id, [...set]);
    words.set(b.id, [...set].map((t) => ({ t, words: t.split(" "), tight: t.replace(/ /g, "") })));
    for (const k of set) { const o = owners.get(k); if (o) o.push(b.id); else owners.set(k, [b.id]); }
  }
  return { all: list.breeds.filter((b) => b.status !== "removed"), byId, terms, words, owners };
}

/** The name in the app's language (English when the id is unknown to this list). */
export function breedName(ix: BreedIndex, id: string | null | undefined, lang: string): string | null {
  const b = id ? ix.byId.get(id) : undefined;
  return b ? b.names[lang] || b.names.en : null;
}

/**
 * The picker's list. Without a query: mixed first, then the common breeds, then all
 * others A-Z in the app's language (other last). With a query: the best matches, also
 * on other languages' names, aliases and small typos.
 */
export function searchBreeds(ix: BreedIndex, query: string, lang: string, opts: { exclude?: string[]; limit?: number } = {}): Breed[] {
  const exclude = new Set(opts.exclude || []);
  const pool = ix.all.filter((b) => !exclude.has(b.id));
  const name = (b: Breed) => b.names[lang] || b.names.en;
  const q = norm(query);
  if (!q) {
    const common = pool.filter((b) => b.rank && b.kind !== "other").sort((a, z) => a.rank! - z.rank!);
    const rest = pool.filter((b) => !b.rank && b.kind !== "other").sort((a, z) => name(a).localeCompare(name(z), lang));
    return [...common, ...rest, ...pool.filter((b) => b.kind === "other")].slice(0, opts.limit ?? Infinity);
  }
  const qWords = q.split(" ");
  const tight = q.replace(/ /g, "");
  const max = allowed(q.length), q0 = q[0];
  const scored: { b: Breed; s: number }[] = [];
  for (const b of pool) {
    const own = norm(name(b));
    let best = 0;
    for (const { t, words, tight: tt } of ix.words.get(b.id) || []) {
      let s = 0;
      if (t === q) s = 100;
      else if (t.startsWith(q)) s = 90;
      else if (words.some((w) => w.startsWith(q))) s = 80;
      else if (qWords.length > 1 && qWords.every((qw) => words.some((w) => w.startsWith(qw)))) s = 75;
      else if (q.length >= 3 && t.includes(q)) s = 60;
      else if (tight.length >= 4 && tt.includes(tight)) s = 55;
      else if (max && best < 45) {
        // a typo (the first letter is rarely the wrong one): the whole term, or a word or the start of one
        let d = t[0] === q0 ? distance(q, t, max) : max + 1;
        for (const w of words) if (d > max && w[0] === q0 && w.length >= q.length - 1) d = Math.min(d, distance(q, w.slice(0, q.length), max), distance(q, w, max));
        if (d <= max) s = 45 - 10 * d;
      }
      if (s && t === own) s += 3;   // the name the owner sees
      if (s > best) best = s;
    }
    if (best) scored.push({ b, s: best + (b.rank ? 2 - b.rank / 100 : 0) });
  }
  scored.sort((a, z) => z.s - a.s || name(a.b).localeCompare(name(z.b), lang));
  // typo matches only when the text itself found little; "other" always last, so a breed that isn't listed can still be typed
  const good = scored.filter((x) => x.s >= 55).length >= 5;
  const out = scored.filter((x) => !good || x.s >= 55).map((x) => x.b).filter((b) => b.kind !== "other");
  const other = ix.byId.get("other");
  if (other && !exclude.has("other")) out.push(other);
  return out.slice(0, opts.limit ?? 50);
}

// ---------------------------------------------------------------- free text -> id
// Words that make a breed text a cross ("Labrador mix", "Teckelmix", "Herder x Husky").
const MIX_WORDS = new Set(["mix", "mixed", "mixbreed", "mengeling", "kruising", "kruisling", "bastaard", "x", "cross", "crossbreed", "mischling",
  "mestizo", "mezcla", "croise", "meticcio", "incrocio", "mieszaniec", "krizenec", "keverek", "blanding", "blandning", "blandras", "sekarotuinen", "metis", "мелез", "метис"]);
const MIX_SUFFIX = /(mix|mixje|kruising|mischling)$/;

/** The single breed a text names: an exact name or alias, else one close typo. */
function matchOne(ix: BreedIndex, text: string): string | null {
  const q = norm(text);
  if (q.length < 2) return null;
  const exact = (ix.owners.get(q) || []).filter((id) => ix.byId.get(id)!.status !== "removed");
  if (exact.length) {
    // a term several entries share ("cocker"): the one where it is a name, else the most common
    const named = exact.filter((id) => Object.values(ix.byId.get(id)!.names).some((n) => norm(n) === q));
    const pick = (named.length ? named : exact).sort((a, z) => (ix.byId.get(a)!.rank || 999) - (ix.byId.get(z)!.rank || 999));
    return pick[0];
  }
  const max = allowed(q.length);
  if (!max) return null;
  let best: string | null = null, bestD = max + 1, tie = false;
  for (const b of ix.all) {
    if (b.kind === "mixed" || b.kind === "other") continue;
    let d = max + 1;
    for (const t of ix.terms.get(b.id) || []) d = Math.min(d, distance(q, t, max));
    if (d < bestD) { best = b.id; bestD = d; tie = false; } else if (d === bestD && d <= max && best !== b.id) tie = true;
  }
  return bestD <= max && !tie ? best : null;
}

/**
 * An old free-text breed as a choice: a known breed, a mix ("Teckelmix" = mixed,
 * mainly Dachshund) or else "other" with the text kept.
 */
export function matchFreeText(ix: BreedIndex, text: string | null): BreedChoice | null {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const whole = matchOne(ix, raw);
  if (whole && whole !== "other" && whole !== "mixed") return { breedId: whole, breed: null, breedSize: null, breedMix: [] };
  const isMixWord = (w: string) => MIX_WORDS.has(w) || (w.length > 4 && MIX_SUFFIX.test(w));
  const mixed = whole === "mixed" || norm(raw).split(" ").some(isMixWord);
  if (!mixed) return { breedId: "other", breed: raw.slice(0, 40), breedSize: null, breedMix: [] };
  // a mix: up to two breeds ("Labrador x Herder", "labrador/poedel"), without the mix words
  const clean = (p: string) => norm(p).split(" ").filter((w) => w && !MIX_WORDS.has(w)).map((w) => (w.length > 4 ? w.replace(MIX_SUFFIX, "") : w)).filter(Boolean).join(" ");
  let parts = raw.toLowerCase().split(/\s+x\s+|\s*[\/&+,×]\s*|\s+(?:en|and|und|et|y|e|met|with|mit)\s+/).map(clean).filter(Boolean);
  if (parts.length < 2) parts = [clean(raw)];
  const ids: string[] = [];
  for (const p of parts) {
    const id = matchOne(ix, p);
    if (id && id !== "mixed" && id !== "other" && !ids.includes(id)) ids.push(id);
  }
  return { breedId: "mixed", breed: null, breedSize: null, breedMix: ids.slice(0, MIX_MAX) };
}

// ---------------------------------------------------------------- labels
type T = (key: string) => string;
type TF = (key: string, vars: Record<string, string | number>) => string;

/** What the app shows: "Labrador Retriever", "Mixed breed · medium · mainly Labrador", "Other breed: Kai Ken mix", or the old text. */
export function breedLabel(ix: BreedIndex, c: Partial<BreedChoice>, lang: string, t: T, tf: TF): string | null {
  if (!c.breedId) return c.breed?.trim() || null;
  if (c.breedId === "other") return c.breed?.trim() || breedName(ix, "other", lang);
  const name = breedName(ix, c.breedId, lang) || c.breed?.trim() || null;
  if (c.breedId !== "mixed") return name;
  const parts = [name];
  if (c.breedSize) parts.push(t("app_size_" + c.breedSize));
  const mainly = (c.breedMix || []).map((id) => breedName(ix, id, lang)).filter(Boolean);
  if (mainly.length) parts.push(tf("app_breedMainlyShort", { breeds: mainly.join(" / ") }));
  return parts.join(" · ");
}

/**
 * What the server gets, in English: `breed` stays readable by older server code
 * (its free-text match finds the card: "Labrador Retriever mix" -> Labrador).
 */
export function breedForServer(ix: BreedIndex, c: Partial<BreedChoice>): { breedId?: string; breed?: string; breedSize?: MixSize } {
  if (!c.breedId) return c.breed?.trim() ? { breed: c.breed.trim().slice(0, 40) } : {};
  if (c.breedId === "other") return { breedId: "other", ...(c.breed?.trim() ? { breed: c.breed.trim().slice(0, 40) } : {}) };
  if (c.breedId === "mixed") {
    const mainly = (c.breedMix || []).map((id) => breedName(ix, id, "en")).filter(Boolean) as string[];
    let breed = mainly.length ? mainly.join(" / ") + " mix" : "Mixed breed";
    if (breed.length > 60) breed = (mainly[0].slice(0, 55) + " mix");
    return { breedId: "mixed", breed, ...(c.breedSize ? { breedSize: c.breedSize } : {}) };
  }
  const en = breedName(ix, c.breedId, "en");
  return { breedId: c.breedId, ...(en ? { breed: en.slice(0, 60) } : {}) };
}

/** A stored choice, cleaned: known ids only, size and mainly only for mixed. */
export function cleanChoice(ix: BreedIndex, c: Partial<BreedChoice>): BreedChoice {
  const id = c.breedId && ix.byId.has(c.breedId) ? c.breedId : null;
  const text = typeof c.breed === "string" && c.breed.trim() ? c.breed.trim().slice(0, 40) : null;
  if (!id) return { breedId: null, breed: text, breedSize: null, breedMix: [] };
  if (id === "mixed") {
    const size = MIX_SIZES.includes(c.breedSize as MixSize) ? (c.breedSize as MixSize) : null;
    const mix = [...new Set((c.breedMix || []).filter((m) => ix.byId.has(m) && m !== "mixed" && m !== "other"))].slice(0, MIX_MAX);
    return { breedId: id, breed: null, breedSize: size, breedMix: mix };
  }
  return { breedId: id, breed: id === "other" ? text : null, breedSize: null, breedMix: [] };
}
