import { defineConfig } from "@playwright/test";

// SPEC.md §9.3: load the built extension in Chromium with a persistent
// context; serve test pages over http://localhost, never file://. The
// persistent-context + --load-extension wiring lives in test/e2e/fixtures.ts
// (Playwright's default browser/context fixtures can't load an unpacked
// extension on their own).
export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  fullyParallel: false, // each test launches its own persistent context + the extension
  reporter: [["list"], ["json", { outputFile: "test/results/results.json" }]],
  use: {
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve.mjs test/e2e/fixtures 8743",
    url: "http://localhost:8743/flashing-video.html",
    reuseExistingServer: !process.env.CI,
  },
});
