// FlashGuard's own behavior on the comparison page's real ffmpeg clips
// (fixtures/vs-neuroshield.html, clips copied from neuroshield-files/). This
// asserts what FlashGuard does, not what NeuroShield does — we don't control
// or redistribute that extension, so the side-by-side itself stays manual.
//
// Uses "low" sensitivity: the literal WCAG-standard preset (SPEC.md §5.5),
// not "balanced"/"high", which are our own unvalidated presets. At
// "balanced" the 19,200 px^2 region case can trip FlashGuard's own
// threshold too — the 17x13 grid's boundary cells (partially covered by
// the flashing patch) inflate the measured area past balanced's lower
// 21,824 px^2 cutoff, even though it's well under "low"'s 43,264.
//
// Each case is checked on its own <video> (by data-mode) rather than by
// counting overlays page-wide, and only videos in view are analyzed
// (SPEC.md §5.6), so each test scrolls its target into view first.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const BASE_URL = "http://localhost:8743";
const CLIPS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/neuroshield-clips");

// Every intervention mode applies brightness(0.08) (intervention.ts FILTERS).
const INTERVENTION_FILTER = "brightness(0.08)";

async function setLowSensitivity(context: BrowserContext): Promise<void> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2];
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  const slider = page.getByLabel("Detection sensitivity");
  await slider.evaluate((el: HTMLInputElement) => {
    el.value = "0"; // "low" — see SENSITIVITIES in popup.ts
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(100); // let the chrome.storage.local write land
  await page.close();
}

async function openWithVideoInView(context: BrowserContext, mode: string): Promise<Page> {
  await setLowSensitivity(context);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/vs-neuroshield.html`);
  await page.locator(`video[data-mode="${mode}"]`).scrollIntoViewIfNeeded();
  return page;
}

function videoFilter(page: Page, mode: string): Promise<string> {
  return page.locator(`video[data-mode="${mode}"]`).evaluate((el: HTMLVideoElement) => el.style.filter);
}

const HAZARDS = [
  { mode: "checker6", clip: "D1_checker_reversal_6hz.mp4", name: "8x8 checkerboard reversing at 6 Hz (NeuroShield misses at every setting)" },
];

for (const { mode, clip, name } of HAZARDS) {
  test(`intervenes on the ${name}`, async ({ context }) => {
    test.skip(!existsSync(path.join(CLIPS_DIR, clip)), `${clip} missing — copy it from neuroshield-files/ (gitignored)`);
    const page = await openWithVideoInView(context, mode);
    await expect(async () => {
      expect(await videoFilter(page, mode)).toContain(INTERVENTION_FILTER);
    }).toPass({ timeout: 6000 });
  });
}

test("never intervenes on the 19,200 px^2 (6.25% of frame) region (safe under WCAG; NeuroShield blocks it)", async ({ context }) => {
  const clip = "B1_area_6pct_5hz.mp4";
  test.skip(!existsSync(path.join(CLIPS_DIR, clip)), `${clip} missing — copy it from neuroshield-files/ (gitignored)`);
  const page = await openWithVideoInView(context, "area6pct");
  // Hold well past the slowest hazard's detection time (~1 s), sampling
  // throughout so a brief engagement can't slip between checks.
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(500);
    expect(await videoFilter(page, "area6pct")).not.toContain(INTERVENTION_FILTER);
  }
});
