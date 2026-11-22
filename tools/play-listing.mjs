// Google Play phone screenshots from a screenshots run (play-listing.yml).
//   node tools/play-listing.mjs <screenshots dir> [--languages "nl en" | all] [--dry-run]
// <dir>/<app language>/*.png (the screenshots-android artifact) go to that language's
// Play locale (store/locales.json, e.g. nb -> no-NO). One edit for all of them: per
// locale the phone screenshots are deleted and the new ones uploaded in name order
// (1-find ... 7-saved), then the edit is committed. Nothing else is touched: no
// bundle, tracks, texts or other images. Locales without a store listing on Play are
// skipped and listed (add the language in Play Console first).
// The service account key comes from env PLAY_SERVICE_ACCOUNT_JSON (never printed);
// --dry-run checks the images and prints the plan without contacting Google.
import { createSign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PACKAGE = "app.snuffel";
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TYPE = "phoneScreenshots";
const gha = !!process.env.GITHUB_ACTIONS;
const notice = (msg) => console.log(gha ? `::notice::${msg}` : `note: ${msg}`);
const warn = (msg) => console.log(gha ? `::warning::${msg}` : `warning: ${msg}`);

// ---- arguments and plan --------------------------------------------------------------
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const li = args.indexOf("--languages");
const wanted = li >= 0 ? String(args[li + 1] || "").split(/\s+/).filter(Boolean) : [];
const dir = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--languages");
if (!dir || !fs.existsSync(dir)) { console.error("usage: node tools/play-listing.mjs <screenshots dir> [--languages \"nl en\"] [--dry-run]"); process.exit(2); }

const LOCALES = JSON.parse(fs.readFileSync(new URL("../store/locales.json", import.meta.url), "utf8")).languages;
const all = !wanted.length || (wanted.length === 1 && wanted[0] === "all");
const unknown = wanted.filter((l) => l !== "all" && !LOCALES[l]);
if (unknown.length) { console.error(`unknown languages: ${unknown.join(" ")} (see store/locales.json)`); process.exit(2); }

/** Width and height of a PNG, or null when the file isn't one. */
function pngSize(buf) {
  const sig = "89504e470d0a1a0a";
  if (buf.length < 24 || buf.subarray(0, 8).toString("hex") !== sig || buf.subarray(12, 16).toString("latin1") !== "IHDR") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// Google Play: 2-8 phone screenshots, PNG or JPEG up to 8 MB, sides 320-3840 px, at most 2:1.
const plan = [], problems = [], absent = [];
for (const [lang, l] of Object.entries(LOCALES)) {
  if (!all && !wanted.includes(lang)) continue;
  const folder = path.join(dir, lang);
  const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter((f) => /\.png$/i.test(f)).sort() : [];
  if (!files.length) { absent.push(lang); continue; }
  if (files.length < 2 || files.length > 8) problems.push(`${lang}: ${files.length} images (Google Play takes 2-8)`);
  const images = files.map((f) => {
    const data = fs.readFileSync(path.join(folder, f));
    const size = pngSize(data);
    if (!size) problems.push(`${lang}/${f}: not a PNG`);
    else if (Math.min(size.w, size.h) < 320 || Math.max(size.w, size.h) > 3840 || Math.max(size.w, size.h) > 2 * Math.min(size.w, size.h)) problems.push(`${lang}/${f}: ${size.w} x ${size.h} (sides 320-3840 px, at most 2:1)`);
    if (data.length > 8 * 1024 * 1024) problems.push(`${lang}/${f}: larger than 8 MB`);
    return { name: f, data };
  });
  plan.push({ lang, play: l.play, images });
}
if (absent.length) notice(`not in the screenshots, Google Play keeps their images: ${absent.join(" ")}`);
if (problems.length) { for (const p of problems) console.error("  " + p); console.error("nothing uploaded"); process.exit(1); }
if (!plan.length) { console.error("no screenshots to upload"); process.exit(1); }
for (const p of plan) console.log(`${p.lang} -> ${p.play}: ${p.images.map((i) => i.name).join(" ")}`);
if (dryRun) { console.log(`dry run: ${plan.length} locale(s), nothing sent`); process.exit(0); }

// ---- Google Play Developer API -------------------------------------------------------
let key;
try { key = JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON || ""); } catch { /* reported below */ }
if (!key || !key.client_email || !key.private_key) { console.error("PLAY_SERVICE_ACCOUNT_JSON is missing or not a service account key"); process.exit(1); }

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
  if (json) headers["content-type"] = "application/json";
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
try {
  const listed = new Map(((await call("GET", `${E}/listings`)).listings || []).map((l) => [l.language.toLowerCase(), l.language]));
  const skipped = [];
  let changed = 0;
  for (const p of plan) {
    const language = listed.get(p.play.toLowerCase());
    if (!language) { skipped.push(`${p.lang} (${p.play})`); continue; }
    const gone = (await call("DELETE", `${E}/listings/${encodeURIComponent(language)}/${TYPE}`)).deleted?.length ?? 0;
    for (const img of p.images) await call("POST", `${U}/listings/${encodeURIComponent(language)}/${TYPE}?uploadType=media`, { data: img.data });
    console.log(`  ${language}: ${gone} removed, ${p.images.length} uploaded`);
    changed++;
  }
  if (skipped.length) warn(`no store listing on Google Play for ${skipped.join(", ")}: not uploaded (add the language in Play Console, Store listing, then run again)`);
  if (!changed) throw new Error("none of these locales has a store listing on Google Play");
  try {
    await call("POST", `${E}:commit`);
    console.log(`committed: phone screenshots of ${changed} locale(s) replaced`);
  } catch (e) {
    // Apps whose changes must be sent for review from Play Console (managed publishing).
    if (!/changesNotSentForReview/i.test(e.apiMessage || "")) throw e;
    await call("POST", `${E}:commit?changesNotSentForReview=true`);
    warn(`saved, not yet sent for review: phone screenshots of ${changed} locale(s). Send the changes for review in Play Console (Publishing overview).`);
  }
} catch (e) {
  await call("DELETE", E).catch(() => undefined);   // nothing half-done stays behind
  console.error(String(e.message || e));
  process.exit(1);
}
