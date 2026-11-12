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
"More settings…"), then visit any page with a real `<video>` playing a fast
flash (5 Hz+, full-frame, high contrast) — the HUD overlay shows live fps,
grid size, transitions-in-window, and peak flashing area. You don't need a
real flashing site to check this, or ffmpeg: `node scripts/serve.mjs
test/e2e/fixtures 8743`, then open

- `http://localhost:8743/flashing-video.html?hz=5` (or `?hz=1` for safe) — one live canvas-driven video, Hz controlled by the query param
- `http://localhost:8743/demo.html` — four side by side (hazard, safe, red flash, sub-threshold region), good for a quick demo

