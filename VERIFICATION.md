# Verification and remaining platform checks

The implementation was checked with Node 24.19.0, Playwright 1.62.1 and Chromium 154.0.8037.57 on Linux. The generator itself has no runtime dependencies or build step.

## Automated results

`node --test tests/core.test.cjs`: **16 tests passed**, none skipped. These cover the exact two-field default and reset factory, all eleven language profiles and Anki TTS expressions, field identities/order/roles, independently filtered sides, repeated languages, supplementary markup, conditional empty-field removal, supported name escaping and invalid names, versioned configuration roundtrips and malformed imports, standalone script compilation, configuration identity, and quality/region/system voice priority.

`node tests/browser.cjs`: **15 scenarios passed**, with no uncaught page errors. The suite starts and closes its own local static server and covers:

- Loaded-app generation with networking disabled; complete See source for all three panels; Tab wrapping, Escape and focus restoration.
- System clipboard roundtrip, exact per-panel copied code, controlled clipboard success/error paths, and selectable manual-copy fallback.
- Adding, renaming, supplementary roles, keyboard moves, deletion, autosave/reopen, reset, JSON download/import, malformed import rejection and duplicate-name feedback.
- Pointer dragging across several rows, touch dragging, and responsive generator layouts at 1280, 390 and 320 pixels wide.
- **Exported front/back templates themselves**, with the generator stylesheet, script tags and global namespace removed. Synthetic Anki substitutions check formatted content, selected-side order, all eleven vector flags, repeated-language fields, visually empty HTML, supplementary grouping, absent-content switches, shared side preferences, configuration isolation and blocked storage.
- Speech selection and statuses with controlled voice doubles: natural fallback ahead of generic primary; delayed/empty/throwing enumeration; duplicate error callbacks; three-attempt bound; one native replay request; missing APIs; network/playback failures; synchronous exceptions; startup timeouts; cancellation and the long-running watchdog.

The note renderer in `tests/helpers.cjs` simulates ordinary Anki field sections, values and native replay controls. It is not Anki’s template parser or native speech engine. Browser speech behavior is tested with doubles because the actual Linux browser exposed the speech API but returned **zero voices** after enumeration. Native replay results and voice identity are not portably observable; generated statuses report a request without asserting audible success.

Screenshots from the latest run are stored locally in ignored `test-artifacts/desktop.png`, `mobile.png` and `generated-card.png`. `git diff --check` passed. The original `FRONTCARD`, `BACKCARD` and `STYLE` reference files were preserved.

## Remaining manual checks

Managed Chromium blocks `file://` navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. Browser tests therefore used a temporary local static server and verified offline generation after loading. The app uses ordinary relative classic scripts and has no fetch or module imports, but direct-from-disk behavior has not been exercised in this managed browser. Verify opening `index.html` in a normal local browser, including that browser’s file-origin storage/clipboard policies. Clipboard failure always offers manual copying.

Windows 11 and actual Anki Desktop, AnkiWeb, AnkiMobile and AnkiDroid were **not available for execution**. Final client checks should create a matching note type, paste all three generated outputs, try populated/empty supplementary notes, switch between question and answer, and play each desired language. Confirm which Windows natural voices actually appear in that client’s speech API. Test with network unavailable when using remote voices. Check the client’s native TTS/locale support and disable automatic audio playback in Anki deck options for click-only speech. Native Anki audio cannot be reliably cancelled or monitored from browser JavaScript.
