// Popup UI. SPEC.md §6.2.
//
// TODO(build order step 6): protection toggle, status line, whitelist
// toggle, mode/sensitivity selectors, "show everything on this page", link
// to options.

import { getSettings } from "../shared/settings";

async function main(): Promise<void> {
  const settings = await getSettings();
  const app = document.getElementById("app");
  if (app) {
    const status = document.createElement("p");
    status.textContent = `Protection is currently ${settings.enabled ? "on" : "off"}.`;
    app.appendChild(status);
  }
}

main().catch((error: unknown) => {
  console.error("[FlashGuard] popup failed to initialize", error);
});
