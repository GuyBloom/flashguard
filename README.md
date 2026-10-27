# FlashGuard

Chrome (Manifest V3) extension that detects hazardous flashing in web
`<video>` in real time and dims/blurs it, for people with photosensitive
epilepsy. See `SPEC.md` for the full product/engineering spec and
`CLAUDE.md` for the non-negotiables.

**Status**: build order step 2 done. `src/detection/*` implements the
reference algorithm (SPEC.md §5.4) with the unit suite in `test/unit/`.
`src/content/*` are still typed stubs that throw `not implemented` (steps
4-5).

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
Chromium context (`test/e2e/fixtures.ts`). The full clip-battery suite and
results table (SPEC.md §9.3) land once detection/sampling/intervention are
implemented; for now there's a smoke test that the extension loads.

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
- The exact definition of the ≤250ms latency target (measured from the 7th
  alternating qualifying transition, not from flash onset — needs
  confirmation from the team).
