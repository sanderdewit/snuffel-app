# Snuffel principles

How we decide, for the app, the website and the data. When a change conflicts
with one of these, change the principle on purpose (in this file), not by accident.

## Experience

1. **Independent first, honestly.** Independent providers come first; chains are
   labelled with the evidence (official list, website, OSM tag), never hidden
   when they're the only option. Every claim has a source.
2. **Every answer ends in an action.** Urgency maps to a button: call your own
   vet first, then an open vet, then the rest. Never only text.
3. **Readable in five seconds when stressed.** Verdict first, at most three
   steps, then what to watch for. No walls of text, least of all at 2 a.m.
4. **Your own vet comes first.** Snuffel supports the relationship with the vet
   ("what do I tell the vet?"); the AI is never a vet and never says it is
   ("dierenarts" is a protected title).
5. **Say it once, clearly.** One clear AI label and one disclaimer per
   conversation, not repeated warnings. Transparency through context.
6. **Show what is shared, where it happens.** Data that leaves the phone (AI
   questions, dog file summary) is visible and switchable on the screen that
   sends it, not two screens deep.
7. **Nothing is required.** No account; every step of the walkthrough can be
   skipped; permissions are asked on the screen that needs them, with the reason.
8. **Destructive actions name exactly what is lost** and offer export or undo.
9. **Local by default.** Dutch first: Dutch date formats, Dutch risks (blauwalg,
   eikenprocessierups, vuurwerk), local time zones. All 29 languages in the same change.
10. **One name per feature,** the same in tab, header, store, errors and screenshots.
11. **Works with less.** Offline (home area on the phone), with script blockers
    (no third-party CDNs; the map is optional, the list is not), on small
    screens (no sideways scrolling), with large text and screen readers.

## Code

12. **One shared core.** Chain detection, categories, opening hours and the
    shared language packs live in `snuffel-data` (`lib/`, `i18n/`); the site and
    the app keep identical copies and CI fails on drift. Change it there first.
13. **The schema is the UI contract.** New AI output is a typed field in the
    response schema that the app renders, not prose the app has to parse.
14. **Local UI state never reaches the server.** Error and system bubbles are
    not conversation turns. Async results are tied to the context they were
    requested in (dog, screen) and checked when they arrive.
15. **Each error has its own text with a next step.** No reusing a generic
    "loading failed" or a field label as an error message.
16. **Interactive elements have a role, a state and a label.** Emoji are
    decoration; colours come from theme tokens that pass WCAG AA contrast.
17. **Privacy by construction.** Data stays on the phone unless a feature needs
    it; nothing is sent to services the user didn't choose; no trackers; keys
    and tokens never in code or logs.
18. **Polite and verifiable data.** robots.txt and crawl delays are honoured;
    AI-extracted facts pass a strict check or are dropped; hand-checked
    corrections carry a source and date; OpenStreetMap's own data always wins.
19. **Measured, not guessed.** Prompt changes run against an evaluation set of
    Dutch scenarios (red flags, puppy, poisoning, behaviour) with the expected
    urgency; log finish reasons and urgency counts, never content.
20. **Tests with the change.** A bug fix comes with the test that would have
    caught it; CI (tests, type check, builds) is green before it ships.
