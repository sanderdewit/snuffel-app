# App Store Connect: everything to enter

Texts and screenshots are in `fastlane/metadata/` (nl-NL primary, en-GB) and are
uploaded by the **store** workflow. The items below are set once by hand in
App Store Connect (or answered in its forms).

## App record (once)

| Field | Value |
|---|---|
| Platform | iOS |
| Name | Snuffel: alles voor je hond (nl) / Snuffel: all for your dog (en). If taken, see note below |
| Primary language | Dutch (Netherlands) |
| Bundle ID | `app.snuffel` (register it first under Certificates, Identifiers & Profiles → Identifiers) |
| SKU | `snuffel-ios` |
| User access | Full access |
| Price | Free (0) |
| Availability | The Netherlands only for now (the data covers 45 countries; more later without an app update) |
| Category | Lifestyle; secondary: Navigation |

If "Snuffel" is already taken as an app name, "Snuffel – hondenzorg dichtbij"
is a fallback that keeps the brand first.

## URLs (needed before review)

| Field | Value |
|---|---|
| Privacy policy URL | https://snuffel.app/privacy (source: docs/privacy-*.md in the website repo) |
| Support URL | https://github.com/sanderdewit/snuffel-app/issues (the privacy page also lists privacy@dewit-automatisering.nl) |
| Marketing URL (optional) | https://snuffel.app/ |

## App Privacy ("nutrition label")

Tracking: **No**. Collected data. Apple counts data as collected when it leaves the
phone and is kept longer than needed to answer the request, including by
services we use. Declare these conservatively:

| Data type | Purpose | Linked to user | Tracking | Why |
|---|---|---|---|---|
| Location: precise location | App Functionality | No | No | Coordinates go to OpenStreetMap Nominatim (address lookup), which keeps server logs for a short time |
| User content: other user content | App Functionality | No | No | AI questions go to Azure OpenAI (EU), which may keep them up to 30 days for abuse monitoring |
| Identifiers: device ID | App Functionality | No | No | Random per-install ID for the AI rate limit, held in memory for 10 minutes |

Not collected: contact info, health (the dog's details only reach the AI as part
of a question), photos (stay on the phone), audio (speech is recognised by the
phone; Snuffel never receives it), usage data, diagnostics.

## Age rating questionnaire

Answer **None** everywhere, except:
- Medical or treatment-focused content: **Infrequent/Mild** (veterinary first aid information)
- Unrestricted web access: **No** (links open the browser, the app has no web view)
- User-generated content / messaging between users: **No**
- AI chatbot / generative AI: **Yes**, if asked: answers are limited to dog health and behaviour, with safety rules

Expected result: 4+ or 9+.

## Encryption / export compliance

Already answered in the app (`ITSAppUsesNonExemptEncryption = false`): only HTTPS,
which is exempt. No questions at upload.

## App Review information

- Contact: your name, phone and e-mail (only visible to Apple)
- Sign-in required: **No**
- Notes: `fastlane/metadata/review_information/notes.txt` (uploaded by the workflow)

## Screenshots

6.9" iPhone (1320 × 2868), made by the **screenshots** workflow: 6 per language
(Find, Emergency, Map, Ask, My dogs, Saved). Apple scales them for smaller
iPhones. No iPad version (iPhone only in version 1).

## Secrets for the workflows (repository → Settings → Secrets → Actions)

| Secret | Where to get it |
|---|---|
| `APPLE_TEAM_ID` | developer.apple.com → Membership details (10 characters) |
| `ASC_KEY_ID` | App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → generate a key with role **Admin** (automatic signing must be able to create the distribution certificate) |
| `ASC_ISSUER_ID` | Same page, above the key list |
| `ASC_KEY_P8` | The downloaded `AuthKey_XXXX.p8`, base64 encoded |

```bash
base64 -i AuthKey_XXXX.p8 | gh secret set ASC_KEY_P8 -R sanderdewit/snuffel-app
```
