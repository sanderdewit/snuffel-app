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
| Support URL | https://github.com/sanderdewit/snuffel-app/issues (the privacy page also lists privacy@dewit-automatisering.nl). Entered per language on the version page (iOS App → 1.0), next to Description and Keywords; the store workflow fills it from `fastlane/metadata/*/support_url.txt` |
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

First page (in-app controls and capabilities, 2026 format): **No** to all:
Parental Controls, Age Assurance, Unrestricted Web Access (links open Safari),
User-Generated Content (nothing is shared between users), Social Media, Social
Media Disabled for Users Under 13 (not applicable), Messaging and Chat (the AI
chat is not user-to-user), Advertising.

Content pages: answer **None** / **No** everywhere (profanity, alcohol, violence
and so on), except:
- Medical or Wellness → Medical or Treatment Information: **Infrequent** (dog health
  guidance only when the user asks the AI; most of the app is a directory)
- Medical or Wellness → Health or Wellness Topics: **Yes** (care tips for the dog;
  consistent with the health declaration on Google Play)
- Unrestricted web access: **No** (links open the browser, the app has no web view)
- User-generated content / messaging between users: **No**
- AI chatbot / generative AI: **Yes**, if asked: answers are limited to dog health and behaviour, with safety rules

Result: **13+** (calculated; mainly from the medical information). Override:
**Not Applicable**; Age Suitability URL: empty.

## Content Rights (App Information)

"Does your app contain, show, or access third-party content?" **Yes**, and confirm
you have the rights: place data and map tiles come from OpenStreetMap (ODbL), with
the attribution shown in the app.

## Encryption / export compliance

Already answered in the app (`ITSAppUsesNonExemptEncryption = false`): only HTTPS,
which is exempt. No questions at upload, and **no** encryption documentation:
if App Store Connect opens "App Encryption Documentation", cancel it (that form is
for apps with their own, non-exempt encryption).

## App Review information

- Contact: your name, phone and e-mail (only visible to Apple)
- Sign-in required: **No**
- Notes: `fastlane/metadata/review_information/notes.txt` (uploaded by the workflow)

## Screenshots

6.9" iPhone (1320 × 2868), made by the **screenshots** workflow: 7 per language
(Find, Emergency, Map, AI help, Dog, Dog file, Saved). Apple scales them for smaller
iPhones. No iPad version (iPhone only in version 1).

## Secrets for the workflows (in the protected `release` environment)

The release-ios and store workflows run in the GitHub environment `release`
(main branch only, your approval per run), so the App Store Connect key is not
readable by other workflows. Set the secrets **with `--env release`**:

| Secret | Where to get it |
|---|---|
| `APPLE_TEAM_ID` | developer.apple.com → Membership details (10 characters) |
| `ASC_KEY_ID` | App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → generate a key with role **Admin** (automatic signing must be able to create the distribution certificate) |
| `ASC_ISSUER_ID` | Same page, above the key list |
| `ASC_KEY_P8` | The downloaded `AuthKey_XXXX.p8`, base64 encoded |

PowerShell, in the folder with the downloaded key (then keep the `.p8` in
KeePass and delete it from disk; Apple lets you download it only once):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\AuthKey_XXXX.p8")) | gh secret set ASC_KEY_P8 -R sanderdewit/snuffel-app --env release
gh secret set ASC_KEY_ID -R sanderdewit/snuffel-app --env release --body XXXX
gh secret set ASC_ISSUER_ID -R sanderdewit/snuffel-app --env release --body <issuer id>
gh secret set APPLE_TEAM_ID -R sanderdewit/snuffel-app --env release --body <team id>
```
