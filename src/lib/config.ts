// Endpoints shared with the website, all on snuffel.app (Azure Front Door:
// website + /api from Static Web Apps, /data and /tiles from storage, cached).
const SITE = "https://snuffel.app";

export const CONFIG = {
  dataBase: SITE + "/data/",                       // places/manifest.json, cells, chains.json
  pmtiles: SITE + "/tiles/snuffel.pmtiles",         // Protomaps basemap (Europe, z14)
  glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
  chatApi: SITE + "/api/chat",
  website: SITE + "/",
  privacy: SITE + "/privacy",
  nominatim: "https://nominatim.openstreetmap.org",
  // Nominatim's usage policy asks for an identifying User-Agent (no personal data).
  userAgent: "Snuffel-app/1.0 (+https://github.com/sanderdewit/snuffel-app)",
  // Countries we cover (snuffel-data/tools/countries.json plus bundled microstates).
  countryCodes: "ad,al,at,ba,be,bg,ch,cy,cz,de,dk,ee,es,fi,fo,fr,gb,gg,gr,hr,hu,ie,im,is,it,je," +
    "li,lt,lu,lv,mc,md,me,mk,mt,nl,no,pl,pt,ro,rs,se,si,sk,sm,ua,va,xk",
  homeRadiusM: 15000,                                 // offline area around home
  emergencySteps: [10000, 25000, 50000]               // metres, as on the website
};
