// Per-cell transition detector. SPEC.md §5.4 step 1.
//
// TODO(build order step 2): implement. See color.ts for why this throws
// instead of stubbing a fake result.

import type { SensitivityConfig } from "./config";
import type { TransitionDirection } from "./types";

/** One cell's rolling window of recent (t, y) samples and emitted-direction state. */
export class CellTransitionTracker {
  constructor(_config: SensitivityConfig) {
    throw new Error("not implemented");
  }

  /**
   * Push one new (t, y) sample for this cell (luminance, or an analogous
   * red-channel signal). Returns the direction emitted on this sample, if
   * any qualifying transition completed. SPEC.md §5.4 step 1.
   */
  push(_tMs: number, _y: number): TransitionDirection | null {
    throw new Error("not implemented");
  }

  reset(): void {
    throw new Error("not implemented");
  }
}
