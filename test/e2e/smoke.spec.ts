// Scaffold sanity check: the built extension loads in Chrome and its
// manifest/popup are reachable. The real clip-battery E2E suite (SPEC.md
// §9.3, build order step 7) lands once sampler/analyzer/intervention are
// implemented — run `npm run build` first.

import { test, expect } from "./fixtures";

test("extension loads and exposes a popup", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await expect(page.locator("h1")).toHaveText("FlashGuard");
});
