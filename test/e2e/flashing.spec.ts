// Real browser, real <video>, real detection pipeline — no pre-rendered
// clip needed: the fixture drives a canvas into the video via
// captureStream(), so requestVideoFrameCallback fires on genuine presented
// frames. SPEC.md §9.3's full clip-battery suite (ffmpeg clips + the
// results table) is still separate, pending build order step 7 — this is a
// proof that steps 4-5's real pipeline (sampler -> analyzer -> intervention)
// actually engages in Chrome, not a synthetic series run through Vitest.

import { test, expect } from "./fixtures";

const BASE_URL = "http://localhost:8743";

test("intervenes on a real 5 Hz full-frame flash", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/flashing-video.html?hz=5`);
  await expect(page.locator('[data-flashguard-state="intervening"]')).toBeVisible({ timeout: 5000 });
});

test("does not intervene on a 1 Hz flash (safe, SPEC.md §9.2 S1)", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/flashing-video.html?hz=1`);
  await page.waitForTimeout(3000);
  await expect(page.locator('[data-flashguard-state="intervening"]')).toHaveCount(0);
});
