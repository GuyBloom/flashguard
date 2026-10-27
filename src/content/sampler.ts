// requestVideoFrameCallback -> FrameSample. SPEC.md §5.2.
//
// TODO(build order step 4): implement. Draws the video into an offscreen
// canvas sized from its displayed CSS size, downsamples to a cols x rows
// grid, and produces a FrameSample per presented frame — never polls at a
// fixed rate (CLAUDE.md "Non-negotiables").

import type { FrameSample, Geometry } from "../detection/types";

export interface SamplerCallbacks {
  onSample(sample: FrameSample, geom: Geometry): void;
  /** Canvas read throws SecurityError, or frames are persistently all-black. SPEC.md §5.7. */
  onUnanalyzable(reason: "tainted" | "black"): void;
}

export class VideoSampler {
  constructor(_video: HTMLVideoElement, _callbacks: SamplerCallbacks) {
    throw new Error("not implemented");
  }

  start(): void {
    throw new Error("not implemented");
  }

  stop(): void {
    throw new Error("not implemented");
  }
}
