// Snuffel app icon: a friendly cartoon dog on the brand orange.
// node dog.mjs <out dir>  ->  icon.png (1024, opaque), adaptive foreground /
// background / monochrome (Android, 1024), preview.png
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const out = process.argv[2] || ".";
const INK = "#2B1B12";

// The dog, drawn in a 1024 box centred at (512, 540).
const dog = (mono = false) => {
  const c = (col) => (mono ? "#ffffff" : col);
  const cut = (col) => (mono ? "#000000" : col);   // details punched out in the monochrome icon
  return `
  <!-- ears -->
  <ellipse cx="292" cy="455" rx="118" ry="215" transform="rotate(24 292 455)" fill="${c("#7A4426")}"/>
  <ellipse cx="732" cy="455" rx="118" ry="215" transform="rotate(-24 732 455)" fill="${c("#7A4426")}"/>
  <!-- head -->
  <ellipse cx="512" cy="545" rx="265" ry="250" fill="${c("#D9975E")}"/>
  <!-- face blaze and muzzle -->
  <path d="M512 330 C 470 330 455 420 452 520 L 572 520 C 569 420 554 330 512 330 Z" fill="${c("#F6E7D4")}"/>
  <ellipse cx="512" cy="672" rx="168" ry="128" fill="${c("#F6E7D4")}"/>
  <!-- eyes -->
  <ellipse cx="404" cy="528" rx="40" ry="46" fill="${cut(INK)}"/>
  <ellipse cx="620" cy="528" rx="40" ry="46" fill="${cut(INK)}"/>
  ${mono ? "" : `<circle cx="418" cy="512" r="14" fill="#fff"/><circle cx="634" cy="512" r="14" fill="#fff"/>
  <circle cx="394" cy="545" r="6" fill="#fff" opacity="0.8"/><circle cx="610" cy="545" r="6" fill="#fff" opacity="0.8"/>`}
  <!-- eyebrows -->
  <path d="M362 462 Q 400 440 438 458" stroke="${cut("#7A4426")}" stroke-width="12" stroke-linecap="round" fill="none"/>
  <path d="M586 458 Q 624 440 662 462" stroke="${cut("#7A4426")}" stroke-width="12" stroke-linecap="round" fill="none"/>
  <!-- cheeks -->
  ${mono ? "" : `<ellipse cx="350" cy="640" rx="44" ry="26" fill="#F4A3A8" opacity="0.55"/><ellipse cx="674" cy="640" rx="44" ry="26" fill="#F4A3A8" opacity="0.55"/>`}
  <!-- tongue -->
  <path d="M470 712 C 470 790 554 790 554 712 Z" fill="${cut("#EF6F86")}"/>
  ${mono ? "" : `<path d="M512 718 L 512 760" stroke="#D9536C" stroke-width="6" stroke-linecap="round"/>`}
  <!-- mouth -->
  <path d="M512 640 L 512 700 M 512 700 Q 466 738 428 702 M 512 700 Q 558 738 596 702" stroke="${cut(INK)}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <!-- nose -->
  <ellipse cx="512" cy="618" rx="62" ry="44" fill="${cut(INK)}"/>
  ${mono ? "" : `<ellipse cx="494" cy="603" rx="20" ry="10" fill="#fff" opacity="0.55"/>`}`;
};

const BG = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FDBA74"/><stop offset="1" stop-color="#EA580C"/></linearGradient></defs>`;

const svg = {
  // iOS / store icon: full bleed, no transparency (iOS rounds the corners itself).
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${BG}<rect width="1024" height="1024" fill="url(#bg)"/>
    <g transform="translate(512 530) scale(0.92) translate(-512 -540)">${dog()}</g></svg>`,
  // Android adaptive icon: the launcher crops to a circle/squircle inside the
  // middle ~66%, so the dog is smaller on a transparent foreground.
  "android-icon-foreground": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <g transform="translate(512 520) scale(0.6) translate(-512 -540)">${dog()}</g></svg>`,
  "android-icon-background": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${BG}<rect width="1024" height="1024" fill="url(#bg)"/></svg>`,
  "android-icon-monochrome": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <g transform="translate(512 520) scale(0.6) translate(-512 -540)">${dog(true)}</g></svg>`
};

fs.mkdirSync(out, { recursive: true });
for (const [name, s] of Object.entries(svg)) {
  const png = new Resvg(s, { fitTo: { mode: "width", value: 1024 } }).render().asPng();
  fs.writeFileSync(path.join(out, name + ".png"), png);
  fs.writeFileSync(path.join(out, name + ".svg"), s);
}
// A rounded preview, as it looks on a phone.
const preview = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><clipPath id="r"><rect width="1024" height="1024" rx="230"/></clipPath></defs>
  <rect width="1024" height="1024" fill="#f1f5f9"/><g clip-path="url(#r)">${svg.icon.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g></svg>`;
fs.writeFileSync(path.join(out, "preview.png"), new Resvg(preview, { fitTo: { mode: "width", value: 512 } }).render().asPng());
console.log("wrote", Object.keys(svg).join(", "), "+ preview");
