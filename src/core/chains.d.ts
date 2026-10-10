// Types for chains.js (shared with the website and snuffel-data; do not edit the .js here).
export type Tags = Record<string, string>;
export interface ChainRef {
  phones?: Record<string, { g: string; n?: string; c?: string; s?: string }>;
  domains?: Record<string, { g: string; n?: string; c?: string; s?: string }>;
  overrides?: Record<string, { chain: string | null; why?: string }>;
}
export interface ChainMatch { group: string | null; via: "manual" | "official" | "website" | "osm" | string }
export function detect(tags: Tags, ref: ChainRef | null, id?: string | null): ChainMatch | null;
export function phoneKey(s: string): string | null;
export function hostOf(u: string): string | null;
