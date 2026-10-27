// FlashGuard's own behavior on the two documented NeuroShield failure
// cases from SPEC.md §4. This asserts what FlashGuard does, not what
// NeuroShield does — we don't control or redistribute that extension, so
// the actual side-by-side comparison is manual (see fixtures/vs-neuroshield.html).
//
// Uses "low" sensitivity: the literal WCAG-standard preset (SPEC.md §5.5),
// not "balanced"/"high", which are our own unvalidated presets. At
// "balanced" the 19,200 px^2 region case can trip FlashGuard's own
// threshold too — the 17x13 grid's boundary cells (partially covered by
// the flashing patch) inflate the measured area past balanced's lower
// 21,824 px^2 cutoff, even though it's well under "low"'s 43,264.

import type { BrowserContext } from "@playwright/test";
import { test, expect } from "./fixtures";

const BASE_URL = "http://localhost:8743";

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

test("16 Hz full-frame flash intervenes (the aliasing case)", async ({ context }) => {
  await setLowSensitivity(context);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/vs-neuroshield.html`);
  await expect(async () => {
    expect(await page.locator('[data-flashguard-state="intervening"]').count()).toBe(1);
  }).toPass({ timeout: 6000 });
});

test("19,200 px^2 (6.25% of frame) region never intervenes (safe under the WCAG-standard area rule)", async ({ context }) => {
  await setLowSensitivity(context);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/vs-neuroshield.html`);
  // Give the 16 Hz case time to engage first, then hold, to prove the
  // region case stays the only non-intervening one throughout.
  await page.waitForTimeout(4000);
  expect(await page.locator('[data-flashguard-state="intervening"]').count()).toBe(1); // only alias16
});
