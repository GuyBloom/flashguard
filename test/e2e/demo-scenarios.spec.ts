// The same page used for live demos (test/e2e/fixtures/demo.html),
// asserted automatically: hazard + red flash intervene, safe + sub-threshold
// region never do. All four are live canvas-driven <video>s, no ffmpeg
// clips needed.

import { test, expect } from "./fixtures";

const BASE_URL = "http://localhost:8743";

test("demo scenarios: hazard and red intervene, safe and sub-threshold region don't", async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/demo.html`);

  // hazard (5 Hz full-frame) and red (saturated red<->gray, 5 Hz) should
  // both reach "intervening" within a few seconds.
  await expect(async () => {
    expect(await page.locator('[data-flashguard-state="intervening"]').count()).toBe(2);
  }).toPass({ timeout: 8000 });

  // Give safe/region plenty of time to prove they stay uninvolved too.
  await page.waitForTimeout(2000);
  expect(await page.locator('[data-flashguard-state="intervening"]').count()).toBe(2);
});
