# Anki Template Generator

Open **index.html** in a modern browser. The app runs directly from disk, works offline, and has no build step, backend, account, API key, or production dependencies. If preferred, serve this directory with `python3 -m http.server 8000`.

1. Enter the exact Anki note field names, select languages, and check Front and/or Back. Add fields as needed. Drag a handle with a mouse or touch, or use its up/down buttons with the keyboard.
2. Mark hints or context as Supplementary. These fields need no language and share a visibility switch. They start hidden; their position in the shared list is preserved.
3. Click Generate. Use See to inspect complete code or Copy to copy it. Match the field checklist in your Anki note type, then paste FRONT SIDE into Front Template, BACK SIDE into Back Template, and STYLE into Styling in Anki’s Cards editor.

Enter actual learning content in Anki. Existing HTML formatting, images and other supported field content pass through to Anki. Back-only fields are absent from the front output. Renaming a field here does not rename it in Anki. Empty Anki fields use conditional sections; the runtime also removes visually empty markup such as `<br>` before deciding which switches apply.

The fresh/reset preset is **English on both sides, Spanish on the back**, with no supplementary fields. Current settings autosave locally, including incomplete edits. Export/Import JSON preserves configuration and field identities and ordering; version 1 supports up to 200 fields. Import validates schema, identities, language keys and types; Generate validates names, duplicates, required languages and side assignments. Imported incomplete drafts remain editable. Anki control syntax and reserved special-field names are rejected. Names with spaces, quotes, ampersands and ordinary HTML punctuation are supported. Local saving can be blocked in private browsing or on some file origins; use JSON backups when the app reports this. Exported configurations contain no learning content.

## Card behavior and voices

Flags and language text start visible; supplementary information starts hidden. Session display preferences are shared across both sides and scoped to the saved configuration ID. Regeneration keeps this ID; reset creates a new one. A JSON copy intentionally preserves the same ID. Storage failures fall back to defaults and working local switches.

The single registry in `js/languages.js` defines all eleven languages, regional browser profiles, Anki TTS locale, flags and voice-name preferences. Browser voice selection ranks quality **before** region: natural/neural primary, natural/neural fallback, generic primary, generic fallback. Within a tier an exposed system voice precedes a remote voice, followed by known voice-name preferences. Online status alone does not establish quality; only explicit natural/neural name or quality metadata is evidence. Non-profile regions are excluded, except the documented Norwegian aliases.

Only voices actually returned by the client’s speech API can be chosen. Windows Narrator installations do not prove availability to Chromium or Anki. This Linux environment cannot verify Windows 11 voice exposure. The practical route is browser speech followed by a native Anki replay control generated with the primary TTS locale. Native TTS may itself use a high-quality system voice, but its quality and voice identity are not portably observable, so it is not falsely ranked as generic or preferred above a known natural voice. Native Anki chooses its configured voice.

Voice enumeration waits up to one second and responds to `voiceschanged`. Each click tries at most three distinct, ranked browser voices, each with a 3.5-second startup deadline. Cancellation invalidates old callbacks; late errors cannot trigger duplicate fallback. Active speech has a two-minute watchdog. A second click stops browser playback. Native replay is requested at most once. Anki’s native replay controls do not expose reliable start/end/error events: the status explicitly reports a **request**, not proof of audible playback. If native playback is silent, check the client’s TTS settings. Native TTS can autoplay depending on Anki settings; disable automatic audio playback in the deck options for click-only operation. Browser JavaScript cannot reliably cancel native Anki audio. AnkiWeb may not render native TTS controls; without browser voices, the card reports speech unavailable and remains readable.

Font files `_GoogleFont.ttf` / `GoogleFont.ttf` are optional Anki media assets; system fonts are used when absent. Flags are embedded vectors and need no emoji font or download. No remote scripts, fonts, images or voice services are required for generation; a selected remote speech voice may require network access.

## Source layout

- `index.html`, `app.css`, `js/app.js`: accessible responsive editor, touch/pointer ordering, source dialogs, clipboard and local/JSON persistence.
- `js/config.js`: defaults, stable identities, validation, import format and movement.
- `js/languages.js`, `js/voice.js`: language registry and independently testable voice policy.
- `js/templates.js`, `js/card-runtime.js`, `js/card-style.js`: conditional Anki output, shared standalone card behavior and shared CSS. CSS is a JavaScript string to enable offline generation from `file://` without fetching assets.
- `FRONTCARD`, `BACKCARD`, `STYLE`: original reference design, retained as supplied. The generator produces configurable replacements.

## Verification

Run `node --test tests/core.test.cjs` for configuration, generation and voice-priority tests. Run `node tests/browser.cjs` with Playwright and Chromium installed for real browser tests of the editor **and rendered exported templates**. Set `CHROMIUM_PATH` to select a Chromium executable (default `/usr/bin/chromium`). Playwright is a development-only test tool; the generator has no dependency on it. The browser suite starts and closes a temporary static server, disables networking for loaded-app generation, uses synthetic note values and controlled speech doubles, and writes screenshots under ignored `test-artifacts/`. The managed test browser blocks file URLs; direct-from-disk operation needs verification in an unrestricted local browser.

See `VERIFICATION.md` for the executed checks and platform limits. Browser checks do not establish audible Windows TTS or compatibility in real Anki Desktop, AnkiWeb, AnkiMobile or AnkiDroid. Those clients need final paste-and-play testing with a note type whose fields match the checklist.
