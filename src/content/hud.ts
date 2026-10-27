// Debug HUD (dev setting only). SPEC.md §6.4.
//
// Per analyzed video, shows sampled fps, grid size, transitions in window,
// peak flashing area (px² and % of threshold), and state. Main calibration
// tool — our biggest technical risk, per SPEC.md §6.4.
//
// TODO(build order step 4-5): implement once sampler.ts and intervention.ts
// are wired, so there is real data to show.

import type { DetectionResult } from "../detection/types";
import type { VideoState } from "./video-registry";

export interface HudStats {
  fps: number;
  cols: number;
  rows: number;
  state: VideoState;
  lastResult: DetectionResult | null;
}

export class DebugHud {
  constructor(_video: HTMLVideoElement) {
    throw new Error("not implemented");
  }

  update(_stats: HudStats): void {
    throw new Error("not implemented");
  }

  destroy(): void {
    throw new Error("not implemented");
  }
}
