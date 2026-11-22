// Run with:  node tests/storetexts.test.mjs
// Store texts fit the stores' limits (trimmed, in Unicode characters): Google Play's
// listing (fastlane/android-metadata/<Play locale>/: title 30, short description 80, full
// description 4000) and release notes (whatsnew, changelogs: 500), and the App Store's
// texts (fastlane/metadata/<locale>/: name 30, subtitle 30, promotional text 170, keywords
// 100 bytes, description 4000, release notes 4000). Every Play locale in store/locales.json has
// its three listing files: Google Play only takes screenshots for a language with a listing.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const PLAY = path.join(root, "fastlane", "android-metadata");
const APPSTORE = path.join(root, "fastlane", "metadata");
const LOCALES = JSON.parse(fs.readFileSync(path.join(root, "store", "locales.json"), "utf8")).languages;
const playLocales = Object.values(LOCALES).map((l) => l.play).sort();

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const read = (file) => fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n").trim();
const chars = (s) => [...s].length;
const dirs = (dir) => fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()).sort();
/** Every given file within its limit (and not empty); the over-long ones in one message. */
function withinLimits(files, measure = chars) {
  const over = [];
  for (const [file, max] of files) {
    const text = read(file), n = measure(text);
    if (!text) over.push(`${path.relative(root, file)}: empty`);
    else if (n > max) over.push(`${path.relative(root, file)}: ${n} > ${max}`);
  }
  assert.deepStrictEqual(over, []);
  assert.ok(files.length > 0, "no files found");
}

console.log("store texts");

// ---- Google Play ---------------------------------------------------------------------
const LISTING = { "title.txt": 30, "short_description.txt": 80, "full_description.txt": 4000 };

test("Google Play: every Play locale in store/locales.json has a title, short and full description", () => {
  const missing = playLocales.flatMap((p) => Object.keys(LISTING).filter((f) => !fs.existsSync(path.join(PLAY, p, f))).map((f) => `${p}/${f}`));
  assert.deepStrictEqual(missing, []);
});

test("Google Play: no listing folders outside store/locales.json", () => {
  assert.deepStrictEqual(dirs(PLAY).filter((d) => d !== "whatsnew"), playLocales);
});

test("Google Play: listing texts within 30 / 80 / 4000 characters", () => {
  withinLimits(playLocales.flatMap((p) => Object.entries(LISTING).map(([f, max]) => [path.join(PLAY, p, f), max])).filter(([f]) => fs.existsSync(f)));
});

test("Google Play: title and short description are one line, without emoji", () => {
  for (const p of playLocales) for (const f of ["title.txt", "short_description.txt"]) {
    const file = path.join(PLAY, p, f);
    if (!fs.existsSync(file)) continue;
    const text = read(file);
    assert.ok(!text.includes("\n"), `${p}/${f} has more than one line`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(text), `${p}/${f} has an emoji`);
  }
});

test("Google Play: release notes (whatsnew, changelogs) within 500 characters", () => {
  const whatsnew = fs.readdirSync(path.join(PLAY, "whatsnew")).map((f) => [path.join(PLAY, "whatsnew", f), 500]);
  const changelogs = playLocales.flatMap((p) => {
    const dir = path.join(PLAY, p, "changelogs");
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).map((f) => [path.join(dir, f), 500]) : [];
  });
  withinLimits([...whatsnew, ...changelogs]);
});

// ---- App Store -----------------------------------------------------------------------
const APP_STORE = { "name.txt": 30, "subtitle.txt": 30, "promotional_text.txt": 170, "description.txt": 4000, "release_notes.txt": 4000 };
const appStoreLocales = dirs(APPSTORE).filter((d) => d !== "review_information");

test("App Store: name, subtitle, promotional text, description and keywords in every locale", () => {
  assert.deepStrictEqual(appStoreLocales, Object.values(LOCALES).map((l) => l.appStore).filter(Boolean).sort());
  const missing = appStoreLocales.flatMap((l) => ["name.txt", "subtitle.txt", "promotional_text.txt", "description.txt", "keywords.txt"].filter((f) => !fs.existsSync(path.join(APPSTORE, l, f))).map((f) => `${l}/${f}`));
  assert.deepStrictEqual(missing, []);
});

test("App Store: name 30, subtitle 30, promotional text 170, description 4000, release notes 4000 characters", () => {
  withinLimits(appStoreLocales.flatMap((l) => Object.entries(APP_STORE).map(([f, max]) => [path.join(APPSTORE, l, f), max])).filter(([f]) => fs.existsSync(f)));
});

// Keywords in UTF-8 bytes: the strict reading of the 100 (bytes are never fewer than
// characters), as the existing keywords were written (Greek and Ukrainian ones were cut
// to fit 100 bytes, about 50 characters).
test("App Store: keywords within 100 (UTF-8 bytes)", () => {
  withinLimits(appStoreLocales.map((l) => [path.join(APPSTORE, l, "keywords.txt"), 100]).filter(([f]) => fs.existsSync(f)), (s) => Buffer.byteLength(s, "utf8"));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
