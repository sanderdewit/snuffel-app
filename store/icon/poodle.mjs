// Snuffel app icon: a blond (apricot-cream) mini poodle, cartoon style.
// node poodle.mjs <out dir> -> icon.png, android-icon-{foreground,background,monochrome}.png, preview.png
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const out = process.argv[2] || ".";
const INK = "#2B1B12";
const COAT = "#F2D29B", CURL = "#E6BC74", EDGE = "#C9984F", FACE = "#F8E3B8", MUZZLE = "#FCF0D6";

// Curly fur: a cluster of overlapping circles, each with a darker edge.
const curls = (pts, r, fill, mono) => pts.map(([x, y, s = 1]) =>
  `<circle cx="${x}" cy="${y}" r="${r * s}" fill="${mono ? "#fff" : fill}" ${mono ? "" : `stroke="${EDGE}" stroke-width="7"`}/>`).join("");

const poodle = (mono = false) => {
  const c = (col) => (mono ? "#ffffff" : col);
  const cut = (col) => (mono ? "#000000" : col);
  // Long curly ears hanging beside the face.
  const earL = [[318, 470], [292, 530, 1.05], [300, 600], [282, 660, 1.05], [300, 725], [330, 772, 0.9], [350, 520, 0.9], [342, 650, 0.9]];
  const earR = earL.map(([x, y, s]) => [1024 - x, y, s]);
  // Topknot: a fluffy pompom of curls on the head.
  const top = [[430, 330], [490, 285, 1.1], [560, 290, 1.05], [610, 340], [470, 360, 0.95], [545, 355, 0.95], [400, 395, 0.85], [625, 400, 0.85], [512, 250, 0.9]];
  return `
  ${curls(earL, 62, CURL, mono)}${curls(earR, 62, CURL, mono)}
  <ellipse cx="512" cy="565" rx="205" ry="215" fill="${c(FACE)}"/>
  ${curls(top, 66, COAT, mono)}
  <ellipse cx="512" cy="690" rx="122" ry="98" fill="${c(MUZZLE)}"/>
  <!-- eyes -->
  <ellipse cx="428" cy="570" rx="34" ry="39" fill="${cut(INK)}"/>
  <ellipse cx="596" cy="570" rx="34" ry="39" fill="${cut(INK)}"/>
  ${mono ? "" : `<circle cx="440" cy="556" r="12" fill="#fff"/><circle cx="608" cy="556" r="12" fill="#fff"/>
  <circle cx="420" cy="586" r="5" fill="#fff" opacity="0.8"/><circle cx="588" cy="586" r="5" fill="#fff" opacity="0.8"/>`}
  ${mono ? "" : `<ellipse cx="376" cy="652" rx="38" ry="22" fill="#F4A3A8" opacity="0.5"/><ellipse cx="648" cy="652" rx="38" ry="22" fill="#F4A3A8" opacity="0.5"/>`}
  <!-- tongue, mouth, nose -->
  <path d="M484 716 C 484 778 540 778 540 716 Z" fill="${cut("#EF6F86")}"/>
  ${mono ? "" : `<path d="M512 722 L 512 754" stroke="#D9536C" stroke-width="5" stroke-linecap="round"/>`}
  <path d="M512 668 L 512 708 M 512 708 Q 478 736 450 710 M 512 708 Q 546 736 574 710" stroke="${cut(INK)}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <ellipse cx="512" cy="650" rx="44" ry="31" fill="${cut(INK)}"/>
  ${mono ? "" : `<ellipse cx="499" cy="640" rx="14" ry="7" fill="#fff" opacity="0.55"/>`}`;
};

const BG = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#F97316"/><stop offset="1" stop-color="#C2410C"/></linearGradient></defs>`;

const svg = {
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${BG}<rect width="1024" height="1024" fill="url(#bg)"/>
    <g transform="translate(512 525) scale(0.95) translate(-512 -520)">${poodle()}</g></svg>`,
  "android-icon-foreground": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <g transform="translate(512 515) scale(0.6) translate(-512 -520)">${poodle()}</g></svg>`,
  "android-icon-background": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${BG}<rect width="1024" height="1024" fill="url(#bg)"/></svg>`,
  "android-icon-monochrome": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <g transform="translate(512 515) scale(0.6) translate(-512 -520)">${poodle(true)}</g></svg>`
};

fs.mkdirSync(out, { recursive: true });
for (const [name, s] of Object.entries(svg)) {
  fs.writeFileSync(path.join(out, name + ".png"), new Resvg(s, { fitTo: { mode: "width", value: 1024 } }).render().asPng());
  fs.writeFileSync(path.join(out, name + ".svg"), s);
}
const inner = svg.icon.replace(/^<svg[^>]*>|<\/svg>$/g, "");
const preview = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2200 1024"><rect width="2200" height="1024" fill="#f1f5f9"/>
  <defs><clipPath id="r"><rect width="1024" height="1024" rx="230"/></clipPath></defs>
  <g clip-path="url(#r)">${inner}</g>
  <g transform="translate(1176 0)"><rect width="1024" height="1024" fill="#1e293b"/>
    <g transform="translate(312 312) scale(0.39)"><g clip-path="url(#r)">${inner}</g></g></g></svg>`;
fs.writeFileSync(path.join(out, "preview.png"), new Resvg(preview, { fitTo: { mode: "width", value: 1100 } }).render().asPng());
console.log("ok");
