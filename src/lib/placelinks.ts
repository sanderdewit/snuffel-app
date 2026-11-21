// Links for a place: call, directions, website, Google reviews, and a note to
// OpenStreetMap when its data is wrong. No imports, so tests/placelinks.test.ts
// runs in plain Node.

interface Spot { lat: number; lon: number }

/**
 * "tel:" with digits and a leading + only ("030 - 123 45 67" -> "tel:0301234567").
 * In an international number the "(0)" is not dialled: "+31 (0)30 ..." is +3130...
 */
export const callUrl = (phone: string) =>
  "tel:" + (/^\s*\+/.test(phone) ? phone.replace(/\(\s*0\s*\)/g, "") : phone).replace(/[^\d+]/g, "");

export const directionsUrl = (p: Spot) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;

/** Google Maps' page for the place, with its reviews: by name near its position. */
export const reviewsUrl = (p: Spot & { name: string | null }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.name || "") + " " + p.lat + "," + p.lon)}`;

/** OpenStreetMap data often has "www.example.nl" without a scheme. */
export const websiteUrl = (w: string) => (/^https?:\/\//i.test(w.trim()) ? w.trim() : "https://" + w.trim());

/** Where the website goes, as people read it: "https://www.example.nl/contact" -> "example.nl". */
export function websiteDomain(w: string): string {
  const m = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/?#]*@)?(?:www\.)?([^/?#:\s]+)/i.exec(w.trim());
  return m ? m[1].toLowerCase().replace(/\.$/, "") : w.trim();
}

/**
 * A new note on OpenStreetMap at the place ("these hours are wrong"): anyone can
 * leave one, without an account, and mappers fix the data at the source.
 */
export const osmNoteUrl = (p: Spot) => {
  const lat = p.lat.toFixed(6), lon = p.lon.toFixed(6);
  return `https://www.openstreetmap.org/note/new?lat=${lat}&lon=${lon}#map=19/${lat}/${lon}`;
};
