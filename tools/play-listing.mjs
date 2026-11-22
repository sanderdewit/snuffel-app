// Google Play store listing: the texts and/or the phone screenshots (play-listing.yml).
//   node tools/play-listing.mjs [--texts] [--screenshots <dir>] [--languages "nl en" | all] [--dry-run]
// --texts: per app language the title, short and full description from
//   fastlane/android-metadata/<Play locale>/ (title.txt, short_description.txt,
//   full_description.txt, trimmed; Play locale from store/locales.json, e.g. nb -> no-NO).
//   A locale without a listing on Play gets one (edits.listings.update creates it), the
//   others are updated; unchanged listings are left alone and a promo video is kept.
//   Languages without these files are skipped and listed.
// --screenshots <dir>: <dir>/<app language>/*.png (the screenshots-android artifact) replace
//   that locale's phone screenshots, uploaded in name order (1-find ... 7-saved). Locales
//   without a listing on Play (also after the texts) are skipped and listed.
// One edit for everything, texts first (a language added by its texts gets its screenshots
// in the same run), then the edit is committed. Nothing else is touched: no bundle, tracks,
// app details or other images. The default language is only read, never changed.
// The service account key comes from env PLAY_SERVICE_ACCOUNT_JSON (never printed).
// --dry-run checks lengths and images and prints the plan; nothing is changed. With a key
// it also reads the current listings (in an edit that is deleted, never committed) to say
// which locales would be created or updated; without one Google isn't contacted.
import { createSign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PACKAGE = "app.snuffel";
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TYPE = "phoneScreenshots";
const META = new URL("../fastlane/android-metadata/", import.meta.url);
// Listing field -> file, its Google Play limit (Unicode characters) and a short name.
const FIELDS = {
  title: { file: "title.txt", max: 30, name: "title" },
  shortDescription: { file: "short_description.txt", max: 80, name: "short" },
  fullDescription: { file: "full_description.txt", max: 4000, name: "full" }
};
const gha = !!process.env.GITHUB_ACTIONS;
const notice = (msg) => console.log(gha ? `::notice::${msg}` : `note: ${msg}`);
const warn = (msg) => console.log(gha ? `::warning::${msg}` : `warning: ${msg}`);
const chars = (s) => [...s].length;
const clean = (s) => String(s ?? "").replace(/\r\n?/g, "\n").trim();

// ---- arguments ----------------------------------------------------------------------
const USAGE = 'usage: node tools/play-listing.mjs [--texts] [--screenshots <dir>] [--languages "nl en" | all] [--dry-run]';
const args = process.argv.slice(2);
const valueOf = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : ""); };
const dryRun = args.includes("--dry-run");
const texts = args.includes("--texts");
const shotsDir = valueOf("--screenshots");
const wanted = String(valueOf("--languages") ?? "").split(/\s+/).filter(Boolean);
const stray = args.filter((a, i) => !["--dry-run", "--texts", "--screenshots", "--languages"].includes(a) && !["--screenshots", "--languages"].includes(args[i - 1]));
if (stray.length || (!texts && shotsDir === undefined) || shotsDir === "" || valueOf("--languages") === "") { console.error(USAGE); process.exit(2); }
if (shotsDir !== undefined && !fs.existsSync(shotsDir)) { console.error(`no such directory: ${shotsDir}`); process.exit(2); }

const LOCALES = JSON.parse(fs.readFileSync(new URL("../store/locales.json", import.meta.url), "utf8")).languages;
const all = !wanted.length || (wanted.length === 1 && wanted[0] === "all");
const unknown = wanted.filter((l) => l !== "all" && !LOCALES[l]);
if (unknown.length) { console.error(`unknown languages: ${unknown.join(" ")} (see store/locales.json)`); process.exit(2); }
const selected = Object.entries(LOCALES).filter(([lang]) => all || wanted.includes(lang));
const problems = [];

// ---- texts: fastlane/android-metadata/<Play locale>/ ---------------------------------
const textPlan = [], noTexts = [];
if (texts) for (const [lang, l] of selected) {
  const folder = new URL(`${l.play}/`, META);
  const present = Object.values(FIELDS).filter((f) => fs.existsSync(new URL(f.file, folder)));
  if (!present.length) { noTexts.push(`${lang} (${l.play})`); continue; }
  if (present.length < 3) { problems.push(`${l.play}: needs all of ${Object.values(FIELDS).map((f) => f.file).join(", ")}`); continue; }
  const t = { lang, play: l.play };
  for (const [key, f] of Object.entries(FIELDS)) {
    t[key] = clean(fs.readFileSync(new URL(f.file, folder), "utf8"));
    if (!t[key]) problems.push(`${l.play}/${f.file}: empty`);
    else if (chars(t[key]) > f.max) problems.push(`${l.play}/${f.file}: ${chars(t[key])} characters (Google Play takes ${f.max})`);
    if (key !== "fullDescription" && t[key].includes("\n")) problems.push(`${l.play}/${f.file}: one line only`);
  }
  textPlan.push(t);
}

// ---- screenshots: <dir>/<app language>/*.png -----------------------------------------
/** Width and height of a PNG, or null when the file isn't one. */
function pngSize(buf) {
  const sig = "89504e470d0a1a0a";
  if (buf.length < 24 || buf.subarray(0, 8).toString("hex") !== sig || buf.subarray(12, 16).toString("latin1") !== "IHDR") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// Google Play: 2-8 phone screenshots, PNG or JPEG up to 8 MB, sides 320-3840 px, at most 2:1.
const shotPlan = [], noShots = [];
if (shotsDir !== undefined) for (const [lang, l] of selected) {
  const folder = path.join(shotsDir, lang);
  const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter((f) => /\.png$/i.test(f)).sort() : [];
  if (!files.length) { noShots.push(lang); continue; }
  if (files.length < 2 || files.length > 8) problems.push(`${lang}: ${files.length} images (Google Play takes 2-8)`);
  const images = files.map((f) => {
    const data = fs.readFileSync(path.join(folder, f));
    const size = pngSize(data);
    if (!size) problems.push(`${lang}/${f}: not a PNG`);
    else if (Math.min(size.w, size.h) < 320 || Math.max(size.w, size.h) > 3840 || Math.max(size.w, size.h) > 2 * Math.min(size.w, size.h)) problems.push(`${lang}/${f}: ${size.w} x ${size.h} (sides 320-3840 px, at most 2:1)`);
    if (data.length > 8 * 1024 * 1024) problems.push(`${lang}/${f}: larger than 8 MB`);
    return { name: f, data };
  });
  shotPlan.push({ lang, play: l.play, images });
}

// ---- the plan ------------------------------------------------------------------------
if (noTexts.length) notice(`no listing texts in fastlane/android-metadata, Google Play keeps their texts: ${noTexts.join(" ")}`);
if (noShots.length) notice(`not in the screenshots, Google Play keeps their images: ${noShots.join(" ")}`);
if (problems.length) { for (const p of problems) console.error("  " + p); console.error("nothing uploaded"); process.exit(1); }
if (!textPlan.length && !shotPlan.length) { console.error(texts && shotsDir === undefined ? "no listing texts to upload" : "nothing to upload"); process.exit(1); }
if (textPlan.length) {
  console.log("texts (characters: title, short, full description):");
  for (const t of textPlan) console.log(`  ${t.lang} -> ${t.play}: ${Object.entries(FIELDS).map(([k, f]) => `${chars(t[k])}/${f.max}`).join(", ")}`);
  const longest = Object.entries(FIELDS).map(([k, f]) => { const t = textPlan.reduce((a, b) => (chars(b[k]) > chars(a[k]) ? b : a)); return `${f.name} ${chars(t[k])} (${t.play})`; });
  console.log(`  longest: ${longest.join(", ")}`);
}
if (shotPlan.length) {
  console.log("phone screenshots:");
  for (const p of shotPlan) console.log(`  ${p.lang} -> ${p.play}: ${p.images.map((i) => i.name).join(" ")}`);
}

let key;
const keyText = process.env.PLAY_SERVICE_ACCOUNT_JSON || "";
try { key = keyText ? JSON.parse(keyText) : undefined; } catch { /* reported below */ }
const usableKey = !!(key && key.client_email && key.private_key);
if (dryRun && !keyText) {
  if (textPlan.length) console.log(`dry run, not checked against Google Play (no PLAY_SERVICE_ACCOUNT_JSON): the texts of ${textPlan.length} locale(s) would be created where Play has no listing in that language yet, otherwise updated: ${textPlan.map((t) => t.play).join(" ")}`);
  if (shotPlan.length) console.log(`dry run: phone screenshots of ${shotPlan.length} locale(s), for those with a listing on Play`);
  console.log("nothing sent");
  process.exit(0);
}
if (!usableKey) { console.error("PLAY_SERVICE_ACCOUNT_JSON is missing or not a service account key"); process.exit(1); }

// ---- Google Play Developer API -------------------------------------------------------
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({ iss: key.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  const assertion = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url")}`;
  const res = await fetch(TOKEN_URL, { method: "POST", body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`sign-in with the service account failed: ${res.status} ${body.error || ""} ${body.error_description || ""}`);
  if (gha) console.log(`::add-mask::${body.access_token}`);
  return body.access_token;
}

let token = "";
async function call(method, url, { json, data } = {}) {
  const headers = { authorization: `Bearer ${token}` };
  if (json) headers["content-type"] = "application/json; charset=utf-8";
  if (data) headers["content-type"] = "image/png";
  const res = await fetch(url, { method, headers, body: data ?? (json ? JSON.stringify(json) : undefined) });
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
  if (!res.ok) {
    const err = new Error(`${method} ${url.replace(UPLOAD, "").replace(API, "")}: ${res.status} ${body.error?.message || text.slice(0, 300)}`);
    err.apiMessage = body.error?.message || "";
    throw err;
  }
  return body;
}

token = await accessToken();
const edit = (await call("POST", `${API}/edits`, { json: {} })).id;
const E = `${API}/edits/${edit}`, U = `${UPLOAD}/edits/${edit}`;
const would = dryRun ? "would be " : "";
let committed = false, failed = false;
try {
  // Read only: the default language (and the other app details) are never written.
  const details = await call("GET", `${E}/details`);
  console.log(`default language on Google Play: ${details.defaultLanguage || "?"} (not changed)`);
  const listings = new Map(((await call("GET", `${E}/listings`)).listings || []).map((l) => [l.language.toLowerCase(), l]));

  // Texts first: edits.listings.update creates a missing listing, so its screenshots can follow.
  const created = [], updated = [], unchanged = [];
  for (const t of textPlan) {
    const cur = listings.get(t.play.toLowerCase());
    const diff = Object.keys(FIELDS).filter((k) => !cur || clean(cur[k]) !== t[k]);
    if (!diff.length) { unchanged.push(cur.language); continue; }
    const language = cur?.language || t.play;
    const listing = { language, title: t.title, shortDescription: t.shortDescription, fullDescription: t.fullDescription, ...(cur?.video ? { video: cur.video } : {}) };
    if (!dryRun) await call("PUT", `${E}/listings/${encodeURIComponent(language)}`, { json: listing });
    listings.set(language.toLowerCase(), listing);
    if (cur) updated.push(`${language} (${diff.map((k) => FIELDS[k].name).join(", ")})`);
    else created.push(language);
  }
  if (textPlan.length) {
    console.log(`texts: ${created.length} ${would}created${created.length ? ": " + created.join(" ") : ""}`);
    console.log(`texts: ${updated.length} ${would}updated${updated.length ? ": " + updated.join(" ") : ""}`);
    if (unchanged.length) console.log(`texts: ${unchanged.length} unchanged: ${unchanged.join(" ")}`);
  }

  const skipped = [];
  let replaced = 0;
  for (const p of shotPlan) {
    const language = listings.get(p.play.toLowerCase())?.language;
    if (!language) { skipped.push(`${p.lang} (${p.play})`); continue; }
    if (dryRun) console.log(`  ${language}: phone screenshots would be replaced by ${p.images.length}`);
    else {
      const gone = (await call("DELETE", `${E}/listings/${encodeURIComponent(language)}/${TYPE}`)).deleted?.length ?? 0;
      for (const img of p.images) await call("POST", `${U}/listings/${encodeURIComponent(language)}/${TYPE}?uploadType=media`, { data: img.data });
      console.log(`  ${language}: ${gone} removed, ${p.images.length} uploaded`);
    }
    replaced++;
  }
  if (skipped.length) warn(`no store listing on Google Play for ${skipped.join(", ")}: screenshots not uploaded (add listing texts for that locale, or the language in Play Console, then run again)`);

  const summary = [created.length + updated.length && `texts of ${created.length + updated.length} locale(s)`, replaced && `phone screenshots of ${replaced} locale(s)`].filter(Boolean).join(" and ");
  if (!summary) {
    if (shotPlan.length && !replaced) throw new Error("none of these locales has a store listing on Google Play");
    console.log("nothing to change: Google Play already has these texts");
  } else if (dryRun) {
    console.log(`dry run: ${summary} would change; edit deleted, nothing changed`);
  } else {
    try {
      await call("POST", `${E}:commit`);
      console.log(`committed: ${summary}`);
    } catch (e) {
      // Apps whose changes must be sent for review from Play Console (managed publishing).
      if (!/changesNotSentForReview/i.test(e.apiMessage || "")) throw e;
      await call("POST", `${E}:commit?changesNotSentForReview=true`);
      warn(`saved, not yet sent for review: ${summary}. Send the changes for review in Play Console (Publishing overview).`);
    }
    committed = true;
  }
} catch (e) {
  console.error(String(e.message || e));
  failed = true;
}
// Nothing half-done stays behind: an edit that wasn't committed is deleted.
if (!committed) await call("DELETE", E).catch(() => undefined);
process.exit(failed ? 1 : 0);
