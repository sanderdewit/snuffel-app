# 🐾 Snuffel for iOS and Android

Find independent vets, groomers, shops, trainers, dog hotels and play areas
across Europe, and see which places belong to large chains. One codebase
(React Native + Expo) for both platforms.

| | |
|---|---|
| **Find** | Address or GPS search, 8 categories, "independents only", map (self-hosted Protomaps basemap) or list |
| **Emergency** | One tap, or the home-screen shortcut: vets and animal hospitals open *now*, nearest first; closed ones hidden; the search widens until there are options; your own vet on top |
| **My dogs** | Profiles (breed, age, weight, photo) with care reminders (vaccination, deworming, flea & tick, check-up) as local notifications |
| **Ask** | AI vet & behaviour help that knows the chosen dog; one conversation per dog, kept on the phone |
| **Saved** | Favourites and "my vet", available offline |
| **Offline** | Places within 15 km of home are kept on the phone |
| **Languages** | 29, following the phone (or chosen in Settings) |

No accounts, no tracking. Everything personal stays on the phone; the AI
questions go to Azure OpenAI in the EU and are not used for training.

## How it fits together

- **Shared core** — chain detection, category rules, opening hours (per country
  time zone) and the 29 language packs come from
  [snuffel-data](https://github.com/sanderdewit/snuffel-data) (`lib/`, `i18n/`),
  the same code the website runs. `node tools/sync-core.mjs` updates the copies;
  CI fails when they differ. App-only texts live in `src/i18n/app/`.
- **Data** — the monthly snuffel-data build publishes places (0.25° cells),
  chain reference data and the Europe basemap to Azure Storage; the app reads
  them directly and keeps a copy in SQLite.
- **AI** — the website's `/api/chat` function. The app sends a random install
  ID (rate limits per install: phones on mobile data often share one IP) and,
  when chosen, the dog's breed / age / weight / sex.

## Development

```bash
npm ci
npm test                 # translations + date logic
npx tsc --noEmit
npx expo run:android     # or run:ios - needs Android Studio / Xcode locally
```

CI builds a signed Android APK/AAB (Play upload key from repository secrets)
and an iOS simulator build on every push; download them from the run's
artifacts.

## Release checklist

- Apple Developer and Google Play accounts (organisation, with D-U-N-S)
- iOS signing in CI (App Store Connect API key) and TestFlight upload
- Play Console: app created, upload key registered, internal test track
- Store listing texts and screenshots, privacy policy URL, data-safety forms
- Domain: links into the app (associated domains / app links)

Place data © OpenStreetMap contributors (ODbL). Basemap: Protomaps.
