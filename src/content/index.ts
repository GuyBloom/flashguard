// Entry point: finds videos, wires everything. SPEC.md §3.
//
// TODO(build order steps 4-6): wire VideoRegistry + sampler + analyzer +
// intervention + messages. For now this is a safe no-op scaffold.
//
// A FlashGuard failure must never break the host page (SPEC.md §8), so the
// whole entry point is wrapped in try/catch.

import { getSettings } from "../shared/settings";

async function main(): Promise<void> {
  const settings = await getSettings();
  if (!settings.enabled) return;

  // TODO: construct a VideoRegistry here once content/video-registry.ts,
  // content/sampler.ts, and content/intervention.ts are implemented
  // (build order steps 4-5).
}

main().catch((error: unknown) => {
  console.error("[FlashGuard] content script failed to initialize", error);
});
