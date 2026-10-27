// Scaffold sanity check: the built extension loads in Chrome and its
// manifest/popup are reachable. The clip-battery E2E suite (SPEC.md §9.3)
// is still build order step 7 — run `npm run build` first.

import { test, expect } from "./fixtures";

test("extension loads and exposes a popup", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await expect(page.locator(".popup-brand strong")).toHaveText("FlashGuard");
  await expect(page.locator(".protection-card .toggle")).toBeVisible();
});
