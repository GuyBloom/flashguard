// Entry point: finds videos, wires everything. SPEC.md §3.
//
// A FlashGuard failure must never break the host page (SPEC.md §8), so the
// whole entry point is wrapped in try/catch.

import { isFlashGuardMessage, type StatusResponse } from "../shared/messages";
import { allowHost, getSettings, onSettingsChanged } from "../shared/settings";
import { VideoRegistry } from "./video-registry";

async function main(): Promise<void> {
  const settings = await getSettings();

  const registry = new VideoRegistry(settings, {
    onStateChange: () => {
      // TODO(build order step 6): report to background/service-worker.ts for
      // the toolbar badge. The popup reads status directly via message (below).
    },
    onAllowSiteRequested: () => {
      void allowHost(location.hostname); // setSettings() picks this up live via onSettingsChanged
    },
  });

  if (settings.enabled) registry.start();

  onSettingsChanged((next) => {
    if (next.enabled && !settings.enabled) registry.start();
    if (!next.enabled && settings.enabled) registry.stop();
    settings.enabled = next.enabled;
    registry.updateSettings(next);
  });

  // The popup has no `tabs` permission, so it asks the content script for
  // the hostname and status instead (SPEC.md §3, §6.2).
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isFlashGuardMessage(message) || message.type !== "flashguard:get-status") return;
    const response: StatusResponse = { hostname: location.hostname, videosByState: registry.getStatusCounts() };
    sendResponse(response);
  });
}

main().catch((error: unknown) => {
  console.error("[FlashGuard] content script failed to initialize", error);
});
