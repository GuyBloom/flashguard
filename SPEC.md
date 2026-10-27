# FlashGuard: Product & Engineering Spec

Audience: Claude Code and the team. Read this fully before writing code.

Rules for using this spec:
- If a shortcut conflicts with this spec, follow the spec. If the spec is ambiguous or looks wrong, stop and ask.
- Items marked **[OPEN]** are undecided. Implement them as configuration constants, never as hard-coded behavior.
- Every numeric threshold must live in one config module with a comment naming its source.

---

## 1. Product summary

FlashGuard is a desktop Chrome extension (Manifest V3) that detects hazardous flashing in web video in real time and dims or blurs it before the user sees it. It is for people with photosensitive epilepsy (PSE).

- It works on any site, not just one platform.
- It never edits, skips, downloads, or re-encodes video. It only reduces what is displayed, and the user can override it.
- Everything runs locally in the browser. There is no server and there are no network requests.

**Primary user ("Alex")**: a remote worker who is online 8+ hours a day and wants to browse media-heavy sites without fearing an untagged, unannounced trigger.
**Secondary users**: people with migraine or visual sensitivity, and caregivers who install or configure the extension for someone else.
**Important**: nobody on the dev team has PSE. Do not rely on team intuition. Default to conservative behavior and plain-language UI.

**Not a medical device.** UI copy must never claim FlashGuard prevents seizures, is medically validated, or guarantees WCAG compliance. It reduces risk based on the WCAG 2.3.1 thresholds.

### Design principles (from the persona checklist)
1. **Detect**: analyze changing visual content for hazardous flashing, including untagged media.
2. **Intervene**: prefer a localized dim/blur over removing frames or restructuring the page.
3. **Fail safely**: when the tool cannot analyze something, say so. Never silently imply it is safe. Always give a clear user control.
4. **Preserve**: keep keyboard navigation, screen-reader semantics, media controls, and layout intact.
5. **Tune**: quick per-site whitelisting, reversible overrides, transparent settings.
6. **Validate**: test false positives, missed triggers, latency, and WCAG scenarios against real decoded video.

### Timeline context
MVP complete Nov 6. First testing Nov 9. Project freeze Dec 4. Final demo Dec 11. Prioritize a correct, tested `<video>` detector over breadth.

---

## 2. Scope

**MVP (must ship)**
- Detect hazardous luminance flashing and red flashing in HTML `<video>` elements, in all frames, including same-origin iframes and embedded players where the video bytes are readable.
- Intervene by dimming/blurring the video, showing "Flashing content hidden" with a "Show anyway" control.
- Global on/off toggle, per-site whitelist, status line, intervention-mode choice, sensitivity choice, settings page.
- Zero configuration needed for protection to be active after install.

**Stretch (in scope, lower priority)**: animated GIF detection, CSS animation detection, sensitivity slider polish, settings/accessibility polish, false-positive tuning on real sites (for example YouTube hover previews).

**Out of scope**: Firefox/Safari, mobile, Chrome Web Store publication, video whose pixels cannot be read (see 5.7), summing flashing across multiple separate videos, canvas/WebGL content, audio, any medical claim.

---

## 3. Architecture

Manifest V3, TypeScript (strict), no runtime dependencies. Dev dependencies are allowed: a bundler (esbuild or Vite), Vitest, Playwright, TypeScript. **Ask before adding any dependency.**

```
flashguard/
  manifest.json
  src/
    detection/        # PURE logic. No DOM, no chrome.* APIs. Fully unit-testable.
      config.ts       # all thresholds + sensitivity presets (single source of truth)
      types.ts
      color.ts        # sRGB -> linear, relative luminance, saturated-red, u'v'
      transitions.ts  # per-cell transition detector
      aggregate.ts    # area aggregation + synchronization + window counting
      analyzer.ts     # FlashAnalyzer (public API)
    content/
      index.ts        # entry: finds videos, wires everything
      video-registry.ts   # discovery (MutationObserver, open shadow roots), lifecycle
      sampler.ts      # requestVideoFrameCallback -> FrameSample
      intervention.ts # apply/restore blur/dim/freeze, overlay UI (Shadow DOM)
      hud.ts          # debug HUD (dev setting only)
    background/service-worker.ts   # per-tab status aggregation, action badge
    popup/            # popup.html/.ts/.css
    options/          # options.html/.ts/.css
    shared/           # settings.ts (storage), messages.ts (typed messages)
  test/
    unit/             # detection tests on synthetic series
    e2e/              # Playwright against the clip battery
    clips/            # generated .mp4 (gitignored) + manifest of expected results
  tools/generate-clips.sh
  README.md
```

**Ownership** (for review boundaries): Detection team owns `src/detection`, `sampler.ts`, performance/privacy audit. Interface team owns `popup`, `options`, `intervention.ts`, accessibility. Validation owns `test/`, `tools/`, release candidate.

**The detection module must not import anything from `content/`, `popup/`, or `chrome`.** It takes numbers in and returns a verdict. This is the key testability boundary.

### Manifest requirements
- `content_scripts`: `matches: ["<all_urls>"]`, `all_frames: true`, `match_about_blank: true`, `run_at: "document_idle"`.
- Permissions: `storage` only. No `tabs`, no `webRequest`, no host permissions beyond the content-script match. To get the current hostname for the popup, ask the content script by message.
- Background: service worker (non-persistent). It must keep no state that cannot be rebuilt.
- Minimum Chrome version 110.

---

## 4. Lessons from prior art (design constraints)

We tested an existing extension (NeuroShield) against synthetic clips with known parameters. These observations shape the design:

- It samples at a fixed **15 fps**. It blocked 20 Hz and 24 Hz full-screen flashing but **missed 16 Hz**, which is near the peak seizure-response rate. This is consistent with sampling-rate aliasing. → **Sample at the video's presented-frame rate, never a fixed low rate.**
- It downsamples to 32×32 and analyzes a 4×4 grid, and it blocked a flash covering only 6.25% of the frame. WCAG's area rule would call that safe. → **Use the WCAG area rule measured in CSS pixels, not "any region flashes".**
- Its unit tests feed hand-built luminance numbers and never exercise real decoded video. → **Our acceptance tests run against real clips in real Chrome.**
- It produced false positives on YouTube hover previews. → **Require alternating transitions meeting duration, magnitude, count, and area criteria, not just "something changed".**

Do not claim a cause for any NeuroShield behavior beyond what is stated here.

---

## 5. Detection engine

### 5.1 Standard being implemented
WCAG 2.3.1 "Three Flashes or Below Threshold", with clarifications from Jordan & Vanderheiden (2024), *International Guidelines for Photosensitive Epilepsy: Gap Analysis and Recommendations*, ACM TACCESS 17(3), Tables 6–7 and Section 6.4.

A **general flash** is a pair of opposing luminance transitions where:
- the change in **relative luminance** is ≥ **0.10** (relative luminance is linear light, 0–1, BT.709 coefficients on linearized sRGB), and
- the **darker state is < 0.80** relative luminance, and
- the transition completes within the **qualifying duration** (66 ms working value).

A **red flash** is a transition to or from a **saturated red** state. Saturated red means `R/(R+G+B) ≥ 0.8` using linearized values. The other state must differ by ≥ 0.2 in CIE 1976 UCS (u′, v′) distance (a black or very dark state counts as a different state).

**Hazard** = more than **3 flashes in any 1-second window** (that is, **≥ 7 alternating transitions whose first and last are less than 1000 ms apart**; a 3 Hz square wave has transitions exactly 1000 ms apart across 7 edges, so it must count as safe), where the flashing area is **at least 25% of a 416×416 CSS-px window**. That is 43,264 CSS px² of flashing within any 416×416 window. If the video is smaller than the window, the threshold stays absolute, so small videos and thumbnails can never reach it.
- **[OPEN]** The WCAG note instead uses 341×256 px (25% = 21,824 px²). Keep both values in config. The "balanced" preset uses the smaller one.

### 5.2 Sampling (content layer: `sampler.ts`)
- Use `video.requestVideoFrameCallback()`. It fires once per presented frame, so there is no polling.
- Timestamp each sample with the callback's wall-clock display time (`expectedDisplayTime` or `now`), **not** `mediaTime`. This keeps the rate correct when `playbackRate` ≠ 1.
- Draw the video into a small offscreen canvas (`OffscreenCanvas` or hidden `<canvas>`, `willReadFrequently: true`, `imageSmoothingQuality: "high"`) sized `cols × rows`, then `getImageData`.
- Grid: choose `cols × rows` from the **displayed** size (`getBoundingClientRect`, CSS px) so that no cell is larger than ~1/32 of the hazard area (about 1,350 CSS px²), capped at 96×54 and floored at 16×9. This prevents small flashes from being averaged away before analysis.
- Convert each cell to linear relative luminance and to a `redSat` flag plus (u′, v′). Note in a code comment that averaging in gamma space introduces a small bias.
- Missing frames: if `presentedFrames` shows dropped frames, record the gap. Do not interpolate. If a gap exceeds 100 ms, call `analyzer.reset()`.

### 5.3 Public API (`src/detection`)

```ts
export type Sensitivity = 'low' | 'balanced' | 'high';   // UI labels: Low / Balanced / High (figma-project naming)

export interface FrameSample {
  tMs: number;               // wall-clock display time, monotonic, ms
  cols: number; rows: number;
  lum: Float32Array;         // relative luminance 0..1 per cell, row-major
  redSat: Uint8Array;        // 1 if saturated red
  u: Float32Array; v: Float32Array;   // CIE 1976 UCS per cell
}
export interface Geometry { widthCss: number; heightCss: number; }

export interface DetectionResult {
  hazardous: boolean;
  reason: 'none' | 'luminance' | 'red' | 'both';
  transitionsInWindow: number;       // area-qualified, alternating
  flashingAreaCssPx2: number;        // peak concurrent flashing area (debug)
}

export class FlashAnalyzer {
  constructor(sensitivity: Sensitivity);
  setSensitivity(s: Sensitivity): void;
  reset(): void;                                                  // on seek, src change, long gap
  push(sample: FrameSample, geom: Geometry): DetectionResult;     // O(cells) per call
}
```

### 5.4 Reference algorithm
Implement this unless you find a better approach that passes every test in section 9.

1. **Per-cell transition detection.** Keep, per cell, a deque of `(t, y)` covering the last `qualifyingMs`. At each sample compute `minW` and `maxW` over that window.
   - Emit **UP** if `y − minW ≥ minLumDelta`, `minW < darkerStateMax`, and the last emitted direction for this cell was not UP.
   - Emit **DOWN** if `maxW − y ≥ minLumDelta`, `y < darkerStateMax`, and the last emitted direction was not DOWN.
   - Directions must alternate. Slow changes (fades) whose change within `qualifyingMs` stays below `minLumDelta` never qualify.
   - Do the same per cell for red transitions (saturated-red state vs. a state ≥ 0.2 away in u′v′).
2. **Aggregation with synchronization.** Per frame, collect the cells that emitted UP and those that emitted DOWN. Cells emitting in the same direction within **20 ms** of each other belong to the same aggregate event. Compute the aggregate's flashing area as the **maximum sum of cell areas inside any `windowCss × windowCss` window** (use a 2D prefix sum). Cell area in CSS px² is `(widthCss/cols) × (heightCss/rows)`. Keep the event only if that area ≥ `hazardAreaCssPx2`.
3. **Window count.** Maintain a list of qualifying aggregate events. Same-direction consecutive events merge. Hazard when ≥ `hazardTransitionsPerSec` alternating events occur with the first and last less than 1000 ms apart. Luminance and red are counted separately, and either one triggers.
4. **Return** a `DetectionResult`. The analyzer itself has **no hysteresis**; that belongs to the content layer (6.1).

### 5.5 Sensitivity presets (`config.ts`)
Values for "low" come from the sources above. **[OPEN]** The balanced and high values are starting guesses to tune during testing.

| Parameter | low | balanced | high |
|---|---|---|---|
| `minLumDelta` | 0.10 | 0.07 | 0.05 |
| `darkerStateMax` | 0.80 | 0.90 | 1.00 (no exception) |
| `qualifyingMs` | 66 | 100 | 150 |
| `hazardTransitionsPerSec` | 7 | 5 | 3 |
| `hazardAreaCssPx2` | 43,264 | 21,824 | 10,000 |
| `windowCss` | 416 | 341×256 (rect) | 341×256 (rect) |
| `syncMs` | 20 | 20 | 20 |

### 5.6 Per-video lifecycle (`video-registry.ts`)
- Discover `<video>` elements in the document and in **open** shadow roots. Watch for additions with `MutationObserver`.
- Analyze a video only while it is playing, visible (`IntersectionObserver`), and at least 64×64 CSS px displayed. Pause analysis when the tab is hidden.
- Cap concurrent analyzers at 4 (prefer the largest visible).
- Call `analyzer.reset()` on `seeking`, `emptied`, `loadstart`, resize, and a source change.
- State machine per video: `idle → analyzing → intervening → analyzing`, plus `unanalyzable` and `allowed`.

### 5.7 Unanalyzable video
If drawing the video taints the canvas (`getImageData` throws a `SecurityError`) or frames are persistently all-black (likely protected media), set state `unanalyzable`. Do not claim it is safe:
- show a small, non-intrusive "FlashGuard can't check this video" indicator on the video, and list the count in the popup;
- offer a manual "Hide this video" control;
- **[OPEN]** an optional setting "Hide videos FlashGuard can't check" (default off).

---

## 6. Intervention and UI

### 6.1 Intervention behavior
- On `hazardous: true`, intervene immediately. **Hysteresis**: stay intervening until 2000 ms have passed with no hazardous result. The intervention must never toggle on and off more than once per second, because toggling could itself create flashing.
- **Blur alone is not an acceptable intervention.** Blurring a full-field luminance flash does not remove the flicker. Every mode must reduce the luminance swing below the thresholds.
- Modes (setting `mode`):
  - `blur` (default **[OPEN]**, branded "Blur" in the UI): dim with `filter: brightness(0.08) blur(8px)`, plus the message overlay. Blur alone cannot satisfy the rule above, so this mode always pairs the blur with the brightness reduction — never blur without the luminance cut.
  - `dim` (branded "Dim"): `filter: brightness(0.08)`, plus the message overlay.
  - `freeze` (branded "Freeze"): apply `blur` and also call `video.pause()`. "Show anyway" resumes playback.
- Apply the filter as an **inline style on the video element** with `!important`, saving and restoring any previous inline `filter` value and priority. This works in fullscreen and follows layout automatically.
- Message overlay: a Shadow-DOM host positioned over the video rect (track scroll/resize). If the video is the fullscreen element, no overlay can render, so rely on the filter, the badge, and the popup control. If a container is fullscreen, mount the overlay inside it. Otherwise mount on `document.body`.
- The overlay and everything FlashGuard adds must have **no animation or transitions**.
- Overlay content: "Flashing content hidden" and two buttons, **Show anyway** (this video, until the page reloads) and **Always allow on this site** (adds to the whitelist).
- Always put a stable attribute on the overlay host (`data-flashguard-state="intervening|unanalyzable"`) for tests. In test builds use an open shadow root.

### 6.2 Popup
- Toggle: **Protection on/off** (global).
- Status line: "No flashing detected" / "2 videos hidden on this page" / "1 video can't be checked".
- "Allow on this site" toggle (whitelist for the current hostname).
- Intervention mode selector (Blur / Dim / Freeze).
- Sensitivity selector (Low / Balanced / High), with one-line plain-language descriptions.
- Page-level "Show everything on this page" button (so the user has a control even when fullscreen blocks the overlay).
- Link to the options page.
- Toolbar badge: amber "!" while any frame in the tab is intervening.

### 6.3 Options page
- Whitelist list with remove buttons. Defaults for mode and sensitivity.
- **Developer: Debug HUD** toggle (off by default, hidden under an "Advanced" section).
- "About & limitations" text: not a medical device; based on WCAG 2.3.1; cannot check some videos; can't guarantee protection.

### 6.4 Debug HUD (dev only)
Per analyzed video, show: sampled fps, grid size, transitions in window, peak flashing area (px² and % of threshold), state. This is the main tool for calibration, which is our biggest technical risk.

### 6.5 Accessibility (requirements, not nice-to-haves)
- Everything operable by keyboard with a visible focus indicator. Do not steal focus when the overlay appears.
- Overlay uses `role="status"` with polite announcement. Buttons have accessible names.
- Text contrast ≥ 4.5:1. Respect `prefers-reduced-motion` (there is no motion anyway) and `prefers-color-scheme`.
- Popup/options pass an automated WCAG 2.2 AA audit with 0 critical violations, and work with a screen reader.

---

## 7. Settings and storage

```ts
interface Settings {
  version: 1;
  enabled: boolean;                  // default true
  sensitivity: Sensitivity;          // default 'balanced'  [OPEN] (figma-project prototype defaults its sensitivity slider to the middle position)
  mode: 'blur' | 'dim' | 'freeze';   // default 'blur'  [OPEN]
  allowedHosts: string[];            // default []
  debugHud: boolean;                 // default false
}
```
- Use **`chrome.storage.local`, never `sync`**. Syncing would send whitelisted hostnames (browsing data) to a Google account.
- Content scripts read settings at start and subscribe to `chrome.storage.onChanged`. Changes apply live, without a reload.
- Validate and migrate on read. Unknown or corrupt data falls back to defaults.

---

## 8. Performance, privacy, security

- Main-thread analysis ≤ 2 ms per frame at p95 on a reference laptop. Added CPU ≤ 5% and no extra dropped frames during 1080p60 playback. Optimize only after correctness. Moving analysis to a Worker is allowed later.
- Memory: only a ring buffer of about 1.2 s of per-cell luminance. Never store frames or screenshots.
- **Zero network requests.** No analytics, telemetry, remote code, remote fonts, or `eval`. Verify with DevTools network inspection and a code grep.
- Wrap all page-facing code in try/catch. A FlashGuard failure must never break the host page. On an unexpected error, put the video in `unanalyzable`.
- Do not change page layout. Everything FlashGuard adds lives in its Shadow-DOM host plus the reversible inline filter.

---

## 9. Testing (this is our main differentiator, so treat it as a first-class feature)

### 9.1 Unit tests (Vitest, `test/unit`)
Generate synthetic `FrameSample` sequences (square/triangle waves at a given Hz, fps, area fraction, luminance levels, red). Cover at least:
- frequency sweep 1–30 Hz at 60 fps; **16, 20, and 24 Hz must be detected** (aliasing regression);
- the 3 Hz boundary (not hazardous), 4 Hz (hazardous);
- luminance delta just above and below 0.10; darker-state exception (≥ 0.80);
- area just below and above the threshold, and a video smaller than the window;
- transitions completing in 1–2 frames vs. slow fades;
- red vs. non-red, and red↔black;
- same-direction synchronization (two regions flashing within 20 ms sum their areas);
- reset on seek and on a long gap.

### 9.2 Clip battery (real video, real Chrome)
`tools/generate-clips.sh` regenerates every clip with ffmpeg (recipes in the appendix). All clips are 640×480. **Display each clip at exactly 640×480 CSS px** in the test page, because the area rule is in CSS pixels.

| ID | Clip | Expected (low) |
|---|---|---|
| H1 | Full-screen B/W square, 5 Hz, 30 fps | **hazard** |
| H2 | Full-screen B/W, 6 Hz | **hazard** |
| H3 | Full-screen B/W, 16 Hz, 60 fps | **hazard** |
| H4 | Full-screen B/W, 20 Hz, 60 fps | **hazard** |
| H5 | Full-screen B/W, 24 Hz, 60 fps | **hazard** |
| H6 | `#FF0000`↔black, 5 Hz | **hazard** (red) |
| H7 | 4 Hz triangle (ramped), 120 fps source | **hazard** |
| H8 | 5 Hz soft-edged square (2–3 frame ramps), 60 fps | **hazard** |
| H9 | 200×150 region flashing 10 Hz (30,000 px²) | **safe** under low, **hazard** under balanced |
| S1 | Full-screen B/W, 1 Hz | safe |
| S2 | Full-screen B/W, 2 Hz | safe |
| S3 | Full-screen B/W, 3 Hz | safe (boundary) |
| S4 | 2-second fades black↔white, repeating | safe |
| S5 | Single hard cut white→black | safe |
| S6 | 5 Hz flash between gray 128 and 146 (delta ≈ 0.07) | safe |
| S7 | 5 Hz flash between 235 and 255 (darker state ≈ 0.83) | safe |
| S8 | 160×120 region flashing 5 Hz (19,200 px²) | safe |
| S9 | ~80×80 region flashing 5 Hz (6,400 px²) | safe |

Notes:
- H1–H8 are checked at 100% area. Use the same geometry for the regional clips.
- S3 is a boundary case. Do not tune thresholds to make it pass at the expense of H1.
- Add more safe clips (cross-dissolves, scrolling text, a hover-preview style loop) as false-positive coverage grows.

### 9.3 E2E (Playwright)
- Load the built extension in Chromium with a persistent context (`--load-extension`, headed or `--headless=new`). Serve test pages over `http://localhost`. **Content scripts do not run on `file://` unless the user enables "Allow access to file URLs"**, so never test from `file://`.
- For each clip: play it, then assert the overlay host reaches `data-flashguard-state="intervening"` within the allowed time for hazards, and never does for safe clips.
- Emit `test/results/results.json` and a Markdown table (clip, expected, actual, latency ms, pass/fail). **This table is a required project deliverable (evidence for the report).**
- Latency: in test builds, dispatch a `flashguard:state` CustomEvent with timestamps. Measure from the first frame at which the hazard condition is satisfied (the 7th alternating qualifying transition) to the filter being applied.

### 9.4 Acceptance targets (from the requirements document)
- Detection: ≥ 95% of hazard clips detected (target 100% of H1–H8).
- False positives: ≤ 10% of safe clips (target 0 of S1–S9).
- Latency: ≤ 250 ms from the moment the hazard condition is first satisfied to intervention. **[OPEN]** The team wrote "reaction time < 250 ms". Because the standard needs ≥ 7 transitions to confirm a hazard, this cannot be measured from flash onset. Confirm the definition above with the team.
- Performance ≤ 5% CPU overhead; zero network requests; popup/options pass the a11y audit.

---

## 10. Suggested build order
1. Scaffold: manifest, build, lint/type-check, Vitest, empty modules, README. Commit.
2. `detection/`: color, transitions, aggregation, analyzer, with the full unit suite (tests first).
3. `generate-clips.sh` and a minimal local test page.
4. `sampler.ts` + `video-registry.ts` with the debug HUD. Confirm real frame rates and grids on the clips.
5. `intervention.ts` (filter + overlay), with hysteresis and restore logic.
6. Settings storage + service worker + popup + options.
7. Playwright E2E over the whole clip battery and the results table.
8. Performance, privacy, and accessibility audits. Fix findings.
9. Stretch: GIF and CSS animation detection.

---

## 11. Working agreements for Claude Code
- Start by proposing a short plan, then work in small steps. Run `npm test` after each module. Show failures; do not hide them.
- Never loosen a threshold or weaken a test to make it pass. If a test looks wrong, explain why and ask.
- Cite the source in a comment for any threshold change.
- Keep `detection/` pure. Keep dependencies at zero at runtime.
- Keep the README current with how to build, load unpacked, run tests, and regenerate clips.
- When something here is marked **[OPEN]**, implement it as config and list the open items back to the team at the end of each session.

---

## Appendix: clip generation recipes (ffmpeg)

These commands were verified to produce playable H.264 clips.

```bash
# Full-frame luminance square wave: gen_flash NAME HZ FPS SECS
gen_flash() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=$3:duration=$4,geq=lum='if(lt(mod(T*$2\,1)\,0.5)\,255\,0)':cb=128:cr=128" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# Region flash on a gray background: gen_region NAME HZ X0 X1 Y0 Y1
gen_region() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=30:duration=6,format=gray,geq=lum='if(between(X\,$3\,$4)*between(Y\,$5\,$6)\,if(lt(mod(T*$2\,1)\,0.5)\,255\,0)\,128)'" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# Saturated red <-> black: gen_red NAME HZ
gen_red() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=30:duration=6,format=rgb24,geq=r='if(lt(mod(T*$2\,1)\,0.5)\,255\,0)':g='0':b='0'" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# Triangle (ramped) wave: gen_tri NAME HZ FPS
gen_tri() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=$3:duration=6,geq=lum='128+127*(2*abs(2*($2*T-floor($2*T+0.5)))-1)':cb=128:cr=128" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# Soft-edged square (ramp ~ 1/GAIN of a half period): gen_soft NAME HZ FPS GAIN
gen_soft() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=$3:duration=6,geq=lum='128+127*clip($4*(2*abs(2*($2*T-floor($2*T+0.5)))-1)\,-1\,1)':cb=128:cr=128" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# Examples
gen_flash H1_5hz 5 30 6            # hazard
gen_flash H3_16hz 16 60 6          # hazard (aliasing regression)
gen_region H9_region_10hz 10 220 420 165 315   # 200x150 px
gen_region S8_region_5hz 5 0 159 0 119         # 160x120 px
gen_red H6_red_5hz 5
gen_tri H7_tri_4hz 4 120
gen_soft H8_soft_5hz 5 60 4
```

For S6 and S7 (reduced delta and bright-state exception), alternate gray levels 128↔146 and 235↔255 with the same square-wave pattern. Note: the `if(...)` luminance values 255/0 in `gen_flash` can be changed to the two levels.

## References
- W3C, WCAG 2.2, Success Criterion 2.3.1 "Three Flashes or Below Threshold".
- J. B. Jordan & G. C. Vanderheiden, "International Guidelines for Photosensitive Epilepsy: Gap Analysis and Recommendations," ACM TACCESS 17(3), 2024. https://doi.org/10.1145/3694790
- South, Saffo & Borkin, "Detecting and Defending Against Seizure-Inducing GIFs in Social Media," CHI 2021 (prior art on a PSE browser extension).
