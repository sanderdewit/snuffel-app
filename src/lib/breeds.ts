// The breed list bundled with the app: src/core/breeds.json, copied from snuffel-data
// (breeds/breeds.json) by tools/sync-core.mjs. New breeds arrive with an app release;
// "Other breed" with the owner's own words covers the gap.
import data from "../core/breeds.json";
import { makeIndex, type BreedIndex, type BreedList } from "./breedsearch";

export * from "./breedsearch";

let index: BreedIndex | null = null;
/** Built on first use (a few hundred breeds, each with its names in 29 languages). */
export function breeds(): BreedIndex {
  if (!index) index = makeIndex(data as unknown as BreedList);
  return index;
}
