# FlashGuard

Chrome (Manifest V3) extension that detects hazardous flashing in web
`<video>` in real time and dims/blurs it, for people with photosensitive
epilepsy. See `SPEC.md` for the full product/engineering spec and
`CLAUDE.md` for the non-negotiables.

**Status**: build order steps 1-5 done. The real pipeline runs end to end:
video discovery (`video-registry.ts`) → sampling (`sampler.ts`) → detection
(`src/detection/*`) → intervention with hysteresis (`intervention.ts`),
plus the debug HUD. Popup/options are functional (real settings, real
status line) but not yet the Figma-matched visual design — that polish is
still open. `background/service-worker.ts`'s per-tab badge aggregation is
the remaining piece of step 6.

## Setup

```sh
npm install
```

## Build

```sh
npm run build
```

Type-checks with `tsc --noEmit`, then bundles each entry point with esbuild
and copies static assets into `dist/`.

## Load unpacked in Chrome

1. `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. **Load unpacked** → select the `dist/` folder
5. After any rebuild, click the reload icon on the extension's card

To see it actually intervene: open the popup, turn on **Debug HUD** (under
"More settings…"), then visit any page with a real `<video>` playing a fast
flash (5 Hz+, full-frame, high contrast) — the HUD overlay shows live fps,
grid size, transitions-in-window, and peak flashing area. You don't need a
real flashing site to check this: `test/e2e/fixtures/flashing-video.html`
(served locally, see **E2E tests** below) drives a live canvas into a
`<video>` at a chosen Hz — no ffmpeg or pre-rendered clip required.

## Unit tests

```sh
npm test        # run once
npm run test:watch
```

Vitest, against `test/unit/`. `src/detection/` is pure (no DOM, no
`chrome.*`), so these run in Node — see `CLAUDE.md`.

## Regenerate the clip battery

```sh
npm run clips
```

Runs `tools/generate-clips.sh` (requires `ffmpeg`, e.g. `brew install
ffmpeg`). Gray recipes start from `format=gray` so Chrome decodes the
intended 8-bit levels; see the comment in the script. Writes the hazard/safe clip battery (H1-H9, S1-S9) into
`test/clips/` — `.mp4` files are gitignored and regenerated on demand;
`test/clips/manifest.json` (checked in) records each clip's expected
result, from SPEC.md §9.2.

## E2E tests

```sh
npm run build   # test:e2e does not build dist/ itself
npm run test:e2e
```

Playwright, loading the built extension from `dist/` in a persistent
Chromium context (`test/e2e/fixtures.ts`), against a local static server
(`scripts/serve.mjs`) serving `test/e2e/fixtures/`. Besides the popup smoke
test, `flashing.spec.ts` drives a real, live-flashing `<video>` (via
`canvas.captureStream()` — no ffmpeg needed) and checks that the real
pipeline engages `data-flashguard-state="intervening"` for a 5 Hz flash and
doesn't for a 1 Hz one. The full ffmpeg clip-battery suite and results
table (SPEC.md §9.3) are still build order step 7.

## Open items

Anything marked **[OPEN]** in `SPEC.md` is implemented as a config value,
never hard-coded. Current list (see `SPEC.md` for each one's section):

- Hazard window size: 416×416 CSS px vs. the WCAG note's 341×256 (both kept
  in config; "balanced"/"high" presets use the smaller one).
- `balanced` and `high` sensitivity preset values are starting guesses, to
  tune against the clip battery.
- Default intervention mode (`blur`, per SPEC.md §6.1).
- Default sensitivity (`balanced`, matching the Figma prototype's slider
  default — not necessarily the "right" default for real-world tuning).
- Optional "hide videos FlashGuard can't check" setting (default off).
- `RED_DARK_STATE_MAX_LUM` (0.01): how dark a state must be to count as
  "different" from saturated red regardless of chromaticity. SPEC.md §5.1
  says "very dark" without a number.
- `BLACK_FRAME_STREAK_FOR_UNANALYZABLE` (30 consecutive samples, ~1s at
  30fps): not in SPEC.md, a starting guess for how long a video must paint
  all-black before we call it unanalyzable rather than genuinely dark.
- The exact definition of the ≤250ms latency target (measured from the 7th
  alternating qualifying transition, not from flash onset — needs
  confirmation from the team).
