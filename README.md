# FlashGuard

Chrome (Manifest V3) extension that detects hazardous flashing in web
`<video>` in real time and dims/blurs it, for people with photosensitive
epilepsy. See `SPEC.md` for the full product/engineering spec.

## Setup

Navigate to source folder flashguard-main in terminal.

Run the following (may need to download and install Node.js from nodejs.org):

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

## Tasks for Testing
To see it actually intervene: open the popup, turn on **Debug HUD** (under
"More settings…")
1. Visit any page with a real `<video>` playing a fast
flash (5 Hz+, full-frame, high contrast) — the HUD overlay shows live fps,
grid size, transitions-in-window, and peak flashing area.

2. Look at the different settings for covering hazardous content, note how the extension reacts.

3. Adjust the sensitivity of the extension, how does it differ on different content?

4. You don't need a real flashing site to check this either, for a demo we have created, run: `node scripts/serve.mjs
test/e2e/fixtures 8743`, then open
- `http://localhost:8743/flashing-video.html?hz=5` (or `?hz=1` for safe) — one live canvas-driven video, Hz controlled by the query param
- `http://localhost:8743/demo.html` — four side by side (hazard, safe, red flash, sub-threshold region), good for a quick demo

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
