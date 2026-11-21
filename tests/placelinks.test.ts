// Run with:  node tests/placelinks.test.ts   (Node 23.6+ runs TypeScript directly)
import assert from "node:assert";
import { callUrl, directionsUrl, osmNoteUrl, reviewsUrl, websiteDomain, websiteUrl } from "../src/lib/placelinks.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e as Error).message); }
}

console.log("placelinks");
test("phone numbers dial digits only", () => {
  assert.strictEqual(callUrl("030 - 123 45 67"), "tel:0301234567");
  assert.strictEqual(callUrl("+31 (0)30 123 4567"), "tel:+31301234567");   // the (0) isn't dialled from abroad
  assert.strictEqual(callUrl("+43 1 234 56 78"), "tel:+4312345678");
});
test("websites: a scheme added when missing", () => {
  assert.strictEqual(websiteUrl("www.dierenarts.nl"), "https://www.dierenarts.nl");
  assert.strictEqual(websiteUrl(" http://dierenarts.nl/contact "), "http://dierenarts.nl/contact");
  assert.strictEqual(websiteUrl("HTTPS://Dierenarts.nl"), "HTTPS://Dierenarts.nl");
});
test("the domain people see", () => {
  assert.strictEqual(websiteDomain("https://www.Dierenkliniek-Oudegracht.nl/openingstijden?x=1"), "dierenkliniek-oudegracht.nl");
  assert.strictEqual(websiteDomain("dierenarts.nl"), "dierenarts.nl");
  assert.strictEqual(websiteDomain("www.dierenarts.nl/"), "dierenarts.nl");
  assert.strictEqual(websiteDomain("http://vet.example.de:8080/x"), "vet.example.de");
  assert.strictEqual(websiteDomain("https://user@vet.example.at/"), "vet.example.at");
  assert.strictEqual(websiteDomain("https://www2.example.fr"), "www2.example.fr");
});
test("maps links", () => {
  assert.strictEqual(directionsUrl({ lat: 52.09, lon: 5.12 }), "https://www.google.com/maps/dir/?api=1&destination=52.09,5.12");
  assert.strictEqual(reviewsUrl({ name: "Kliniek & Co", lat: 52.09, lon: 5.12 }), "https://www.google.com/maps/search/?api=1&query=Kliniek%20%26%20Co%2052.09%2C5.12");
  assert.strictEqual(reviewsUrl({ name: null, lat: 1, lon: 2 }), "https://www.google.com/maps/search/?api=1&query=%201%2C2");
});
test("a note to OpenStreetMap at the place", () => {
  assert.strictEqual(osmNoteUrl({ lat: 52.0907374, lon: 5.1214201 }), "https://www.openstreetmap.org/note/new?lat=52.090737&lon=5.121420#map=19/52.090737/5.121420");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
