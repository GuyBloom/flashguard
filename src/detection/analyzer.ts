// FlashAnalyzer: the detection engine's public API. SPEC.md §5.3-§5.4.
//
// TODO(build order step 2): implement the reference algorithm (§5.4) using
// color.ts, transitions.ts, and aggregate.ts. See color.ts for why methods
// throw instead of stubbing a fake result.

import type { SensitivityConfig } from "./config";
import { SENSITIVITY_PRESETS } from "./config";
import type { DetectionResult, FrameSample, Geometry, Sensitivity } from "./types";

export class FlashAnalyzer {
  private config: SensitivityConfig;

  constructor(sensitivity: Sensitivity) {
    this.config = SENSITIVITY_PRESETS[sensitivity];
  }

  setSensitivity(sensitivity: Sensitivity): void {
    this.config = SENSITIVITY_PRESETS[sensitivity];
  }

  /** Call on seek, src change, or a sample gap > MAX_GAP_MS. SPEC.md §5.2, §5.6. */
  reset(): void {
    throw new Error("not implemented");
  }

  /** O(cells) per call. SPEC.md §5.3. */
  push(_sample: FrameSample, _geom: Geometry): DetectionResult {
    void this.config; // TODO(build order step 2): drive transitions.ts/aggregate.ts with this
    throw new Error("not implemented");
  }
}
