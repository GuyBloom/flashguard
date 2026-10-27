// Loads the built extension (dist/) into a persistent Chromium context.
// Playwright Test's default context/browser fixtures can't load an unpacked
// extension, so this overrides them. Pattern per Playwright's documented
// approach for extension testing. SPEC.md §9.3.
//
// Run `npm run build` before `npm run test:e2e` — this fixture does not
// build dist/ itself.

import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, "../../dist");

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      headless: false, // extensions require headed, or Chrome's new headless mode
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent("serviceworker");
    const id = worker.url().split("/")[2];
    if (!id) throw new Error("Could not determine extension id from service worker URL.");
    await use(id);
  },
});

export const expect = test.expect;
