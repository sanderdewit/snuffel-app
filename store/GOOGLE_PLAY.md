# Google Play Console: everything to enter

Texts and images for the listing: `fastlane/android-metadata/` (nl-NL primary,
en-GB). Phone screenshots in all 29 languages: the **screenshots** workflow
(`screenshots-android` artifact, 16:9 phone), uploaded by **play-listing** (see 6).

## 1. Developer account (once)

- play.google.com/console → create account → **Organisation**
- D-U-N-S number of De Wit Automatisering B.V.; name and address exactly as at D&B
- Website: https://snuffel.app (or dewit-automatisering.nl), contact e-mail and phone
- $25 once; verification takes a few days
- Organisation accounts don't need the "12 testers for 14 days" closed test

## 2. Create the app

| Field | Value |
|---|---|
| App name | Snuffel: alles voor je hond |
| Default language | Dutch (nl-NL) |
| App or game | App |
| Free or paid | Free |
| Package name | `app.snuffel` (fixed in the app) |

## 3. Signing: Play App Signing with our upload key

Release → Setup → App signing: keep **Play App Signing** on (Google keeps the
app signing key). Our **upload key** (`upload.p12`, alias `upload`, password
and certificate) is in KeePass; its SHA-256 starts `34:08:56:A5` and ends
`2B:41:BC`. In GitHub the key only lives in the protected `release`
environment (approval required). The first upload registered it.

**A release by hand** (until the service account below exists): Actions →
**release-android** → Run → approve in GitHub → download the artifact
`snuffel-play-<n>` → Play Console: Testing → Internal testing → Create release →
upload `app-release.aab`. Release name `0.1.0 (<version code>)`. The R8
mapping file and native debug symbols travel **inside** the bundle; Play
extracts them itself (nothing extra to upload). Testers: an e-mail list on the
Testers tab; open its opt-in link on the device.

No Android phone? Use an Android Studio emulator with a Google Play image, or
the **Pre-launch report** (Google tests every release on real devices).

## 4. Automatic uploads afterwards

1. console.cloud.google.com → new project "snuffel-play" → enable **Google Play
   Android Developer API**.
2. IAM → Service accounts → create `play-upload` → Keys → Add key → JSON.
3. Play Console → Users and permissions → Invite new user → the service
   account's e-mail → app Snuffel → permissions **Release to testing tracks**
   and **View app information**.
4. Store the key as secret (from the folder with the downloaded JSON), then
   delete the file:

```bash
gh secret set PLAY_SERVICE_ACCOUNT_JSON --env release -R sanderdewit/snuffel-app < play-upload-key.json
```

(PowerShell: `Get-Content .\play-upload-key.json -Raw | gh secret set PLAY_SERVICE_ACCOUNT_JSON --env release -R sanderdewit/snuffel-app`.)
Set up on 22 November 2026 (account `play-upload`, permissions: View app
information, Release to testing tracks, Release to production, Manage store presence).

Then Actions → **release-android** → Run: track `internal` (test track) or
`production` (the public release, after Google's review), status `completed`
(or `draft` to roll it out by hand in Play Console). The release notes come from
fastlane/android-metadata/whatsnew.

## 5. App content (Policy → App content)

| Form | Answer |
|---|---|
| Privacy policy | https://snuffel.app/privacy |
| Ads | No ads |
| App access | All functionality available without special access (no login) |
| Target audience | 16 and over (matches the privacy policy and the Dutch GDPR age of consent; under 13 would bring the Families programme). Appeals to children: No |
| News app | No |
| Government app | No |
| Financial features | None |
| Health apps | Declare: the app offers general **pet** health information and an AI assistant; it does not process human health data, is not a medical device and does not replace a vet. Category: "Other" (pet health) |
| Data safety | See below |
| Content rating (IARC) | See below |

### Data safety

| Question | Answer |
|---|---|
| Does the app collect or share user data? | Yes (collects; nothing is shared or sold) |
| Encrypted in transit? | Yes (HTTPS only) |
| Users can request deletion? | Yes: personal data is on the phone (delete in the app or uninstall); other requests via privacy@snuffel.app |
| Account creation | None |

Data types (all **not shared**, **not for ads/analytics**, purpose **App functionality**):

| Data type | Collected | Processed ephemerally | Required | Why |
|---|---|---|---|---|
| Location → Precise location | Yes | Yes | Optional (an address can be typed) | Address lookup via OpenStreetMap Nominatim |
| App activity → Other user-generated content | Yes | No | Optional | AI questions (and, if enabled, a summary of the dog's file) to Azure OpenAI in the EU; Microsoft may keep them up to 30 days for abuse monitoring. Since 1.0.3 also **Analytics**: a conversation the user chooses to send after a thumbs down (consent screen; dog's name removed), kept 12 months to improve the assistant |
| Device or other IDs | Yes | Yes | Required for the AI | Random install ID for the AI rate limit, in memory for 10 minutes |

Not collected: name, e-mail, contacts, photos (stay on the phone), audio (speech
recognition by the phone itself), health/fitness (about the user), financial
info, messages, web history, crash logs, diagnostics.

### Content rating (IARC questionnaire)

- Category: **Reference, news or educational** (or "All other app types")
- Violence, sexuality, language, controlled substances, gambling: **No**
- Users can interact or exchange content: **No**
- Shares location with other users: **No**
- Digital purchases: **No**
- Unrestricted internet / web browser: **No**
- AI-generated content: **Yes**, if asked: a chat assistant limited to dog health and behaviour, with safety rules

Expected: PEGI 3 / Everyone.

## 6. Store listing (Grow → Store presence → Main store listing)

| Field | Source |
|---|---|
| App name, short description, full description | `fastlane/android-metadata/<lang>/` |
| App icon (512 × 512) | `…/images/icon.png` |
| Feature graphic (1024 × 500) | `…/images/featureGraphic.png` |
| Phone screenshots (2-8) | `screenshots-android` artifact, uploaded by the **play-listing** workflow (below) |
| Category | Lifestyle |
| Contact e-mail | support@snuffel.app |
| Website | https://snuffel.app |

### Phone screenshots (automatic)

1. Actions → **screenshots** → Run (languages `all`, or a few codes such as
   `nl en`; platforms `android`, or both for the App Store too). The app is built
   once, then about five languages per runner in parallel; the `screenshots-android`
   artifact holds `<lang>/1-find.png … 7-saved.png` (1080 × 1920). A failed
   group: **Re-run failed jobs**, which merges again.
2. Actions → **play-listing** → Run with that run's ID (from its URL), approve in
   GitHub. Per Play locale the phone screenshots are replaced (app language →
   Play locale in `store/locales.json`, e.g. `nb` → `no-NO`, `sr` → `sr`, Latin
   script). Nothing else changes: no bundle, tracks, texts or other images.
   Locales without a store listing translation on Play are skipped with a
   warning (add the language under Store listing first). Play reviews the change
   like any listing edit; if Play says changes can't be sent for review
   automatically, they are saved and you send them in Publishing overview.

Countries: **the Netherlands** only for now (the data covers 45 countries, so
more can be added later without an app update).
