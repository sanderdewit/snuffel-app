# Snuffel app (Expo, public repo)

## Copied files: never edit these directly
- `src/core/{chains,classify,hours}.js`, `src/i18n/packs/*.json` and `src/i18n/packs.ts` come from the public snuffel-data repo.
  Change them in snuffel-data first and push that, then run `node tools/sync-core.mjs`. CI fails (`--check`) when a copy differs from snuffel-data@main.
- App-only texts live in `src/i18n/app/*.json` (29 languages, Serbian in Latin script).

## Before and after every push
- Check `git branch --show-current` and `git fetch`. The release workflows (`release-ios`, `release-android`) build **main**: commits on another branch never reach TestFlight or Play.
- Run `npx tsc --noEmit`, `npm test` and `node tools/sync-core.mjs --check` locally.
- After pushing or starting a release, **watch the run until it is green** (`gh run watch <id> --exit-status`) before saying it is done. Release runs need the owner's approval on GitHub.
- Native code (voice, audio, WebRTC) can't be tested in a simulator or emulator. Say so, and ask for a device test instead of assuming it works.

## Conventions
- No `Co-Authored-By` / "Generated with" lines in commits or PRs.
- Don't commit `*.ips` crash reports (they contain device IDs).
- Store texts: `fastlane/metadata/<locale>/`, uploaded by the `store` workflow (input `app_version`).
