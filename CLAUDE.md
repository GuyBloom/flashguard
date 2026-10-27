# FlashGuard

Chrome (Manifest V3) extension that detects hazardous flashing in web `<video>` in real time and dims/blurs it, for people with photosensitive epilepsy.

**Read `SPEC.md` fully before doing any work.** It is the source of truth for scope, architecture, the detection algorithm, thresholds, UI behavior, and tests.

## Non-negotiables
- TypeScript strict. **Zero runtime dependencies.** Ask before adding any dependency.
- `src/detection/` is pure logic: no DOM, no `chrome.*`, no imports from other layers.
- Zero network requests. No analytics, remote code, or `eval`. Settings use `chrome.storage.local`, never `sync`.
- Sample video at its presented-frame rate with `requestVideoFrameCallback`; never at a fixed low rate.
- Every intervention must reduce the luminance swing below the thresholds. Blur alone is not enough.
- No animation or transitions in anything FlashGuard adds to a page.
- Never loosen a threshold or weaken a test to make it pass. Explain and ask instead.
- Test over `http://localhost`, never `file://`.

## Commands (create these in `package.json`)
- `npm run build`: bundle to `dist/` (load unpacked in Chrome)
- `npm test`: unit tests (Vitest)
- `npm run test:e2e`: Playwright against the clip battery
- `npm run clips`: regenerate test clips with ffmpeg

## Open decisions
Anything marked **[OPEN]** in `SPEC.md` must be a config value. List open items back to the team at the end of each session.
