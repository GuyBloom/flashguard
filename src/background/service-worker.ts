// Per-tab status aggregation + action badge. SPEC.md §3, §6.2.
//
// Non-persistent service worker: keeps no state that cannot be rebuilt
// (CLAUDE.md "Non-negotiables" / SPEC.md §3). Settings live in
// chrome.storage.local, not in worker memory.
//
// TODO(build order step 6): aggregate per-tab intervention state from
// content-script messages and set the amber "!" badge (SPEC.md §6.2).

import { DEFAULT_SETTINGS, getSettings, setSettings } from "../shared/settings";

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const existing = await getSettings();
    if (existing.version !== DEFAULT_SETTINGS.version) {
      await setSettings(DEFAULT_SETTINGS);
    }
  })();
});
