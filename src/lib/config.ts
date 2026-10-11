// Endpoints shared with the website. When the snuffel.app domain (behind Azure
// Front Door) exists, these become https://snuffel.app/... in one place.
const STORAGE = "https://snuffelf45degiiws6q4.blob.core.windows.net";

export const CONFIG = {
  dataBase: STORAGE + "/data/",                       // places/manifest.json, cells, chains.json
  pmtiles: STORAGE + "/tiles/snuffel.pmtiles",         // Protomaps basemap (Europe, z14)
  glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
  chatApi: "https://wonderful-island-0c49a0103.7.azurestaticapps.net/api/chat",
  website: "https://wonderful-island-0c49a0103.7.azurestaticapps.net/",
  privacy: "https://wonderful-island-0c49a0103.7.azurestaticapps.net/privacy",
  nominatim: "https://nominatim.openstreetmap.org",
  // Nominatim's usage policy asks for an identifying User-Agent (no personal data).
  userAgent: "Snuffel-app/1.0 (+https://github.com/sanderdewit/snuffel-app)",
  // Countries we cover (snuffel-data/tools/countries.json plus bundled microstates).
  countryCodes: "ad,al,at,ba,be,bg,ch,cy,cz,de,dk,ee,es,fi,fo,fr,gb,gg,gr,hr,hu,ie,im,is,it,je," +
    "li,lt,lu,lv,mc,md,me,mk,mt,nl,no,pl,pt,ro,rs,se,si,sk,sm,ua,va,xk",
  homeRadiusM: 15000,                                 // offline area around home
  emergencySteps: [10000, 25000, 50000]               // metres, as on the website
};
