// Types for classify.js (shared with the website and snuffel-data; do not edit the .js here).
export type Category = "vet" | "hospital" | "grooming" | "shop" | "boarding" | "training" | "play" | "shelter";
export function classify(tags: Record<string, string>): Category | null;
export const KEEP_TAGS: RegExp;
