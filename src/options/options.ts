// Options page. SPEC.md §6.3.
//
// TODO(build order step 6): whitelist list with remove buttons, mode/
// sensitivity defaults, Developer > Debug HUD toggle, "About & limitations".

import { getSettings } from "../shared/settings";

async function main(): Promise<void> {
  const settings = await getSettings();
  const app = document.getElementById("app");
  if (app) {
    const list = document.createElement("p");
    list.textContent = `Allowed hosts: ${settings.allowedHosts.length === 0 ? "none" : settings.allowedHosts.join(", ")}`;
    app.appendChild(list);
  }
}

main().catch((error: unknown) => {
  console.error("[FlashGuard] options page failed to initialize", error);
});
