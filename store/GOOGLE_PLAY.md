# Google Play Console: everything to enter

Texts and images for the listing: `fastlane/android-metadata/` (nl-NL primary,
en-GB). Screenshots: the **screenshots** workflow (`screenshots-android`
artifact, 16:9 phone).

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
app signing key). Our **upload key** certificate: `C:\temp\snuffel-secrets\cert.pem`
(SHA-256 in `upload-cert-sha256.txt`). The first upload registers it
automatically when you upload a bundle signed with it.

**First release by hand:** Testing → Internal testing → Create release → upload
the `.aab` from the latest green **ci** run (artifact `snuffel-android-<n>`,
file `app-release.aab`, version code 1). Add yourself as tester (e-mail list).

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
gh secret set PLAY_SERVICE_ACCOUNT_JSON -R sanderdewit/snuffel-app < play-upload-key.json
```

Then Actions → **release-android** → Run (status `draft` until the app has
been published once, `completed` afterwards).

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
| Users can request deletion? | Yes: personal data is on the phone (delete in the app or uninstall); other requests via privacy@dewit-automatisering.nl |
| Account creation | None |

Data types (all **not shared**, **not for ads/analytics**, purpose **App functionality**):

| Data type | Collected | Processed ephemerally | Required | Why |
|---|---|---|---|---|
| Location → Precise location | Yes | Yes | Optional (an address can be typed) | Address lookup via OpenStreetMap Nominatim |
| App activity → Other user-generated content | Yes | No | Optional | AI questions (and, if enabled, a summary of the dog's file) to Azure OpenAI in the EU; Microsoft may keep them up to 30 days for abuse monitoring |
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
| Phone screenshots (2-8) | `screenshots-android` artifact |
| Category | Lifestyle |
| Contact e-mail | your support address (e.g. support@snuffel.app via Cloudflare Email Routing) |
| Website | https://snuffel.app |

Countries: **the Netherlands** only for now (the data covers 45 countries, so
more can be added later without an app update).
