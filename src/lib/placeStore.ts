// Hands a Place from a list to its detail screen without putting it in the URL.
// Links from outside (or after the app was killed) carry id + lat/lon instead,
// and the detail screen looks the place up again.
import type { Place } from "./places";

const recent = new Map<string, Place>();
export function remember(p: Place) {
  recent.set(p.id, p);
  if (recent.size > 300) recent.delete(recent.keys().next().value as string);
}
export const recall = (id: string) => recent.get(id) || null;
