// Apply/restore the filter, the Shadow-DOM overlay, and hysteresis.
// SPEC.md §6.1.
//
// TODO(build order step 5): implement. Blur alone is not an acceptable
// intervention — every mode must reduce the luminance swing below the
// thresholds (CLAUDE.md "Non-negotiables"). Stay intervening until 2000 ms
// have passed with no hazardous result; never toggle more than once/sec.

import type { InterventionMode } from "../shared/settings";

export class Intervention {
  constructor(_video: HTMLVideoElement, _mode: InterventionMode) {
    throw new Error("not implemented");
  }

  setMode(_mode: InterventionMode): void {
    throw new Error("not implemented");
  }

  /** Apply the filter + overlay. Idempotent. */
  engage(): void {
    throw new Error("not implemented");
  }

  /** Restore the video's original inline filter and remove the overlay. */
  release(): void {
    throw new Error("not implemented");
  }

  /** "FlashGuard can't check this video" indicator + manual hide control. SPEC.md §5.7. */
  showUnanalyzable(): void {
    throw new Error("not implemented");
  }
}
