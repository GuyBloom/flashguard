// Video discovery (MutationObserver, open shadow roots) and per-video
// lifecycle. SPEC.md §5.6.
//
// TODO(build order step 4): implement. State machine per video:
// idle -> analyzing -> intervening -> analyzing, plus unanalyzable and
// allowed. Caps concurrent analyzers at 4 (prefer the largest visible).

export type VideoState = "idle" | "analyzing" | "intervening" | "unanalyzable" | "allowed";

export interface VideoRegistryCallbacks {
  onStateChange(video: HTMLVideoElement, state: VideoState): void;
}

export class VideoRegistry {
  constructor(_callbacks: VideoRegistryCallbacks) {
    throw new Error("not implemented");
  }

  start(): void {
    throw new Error("not implemented");
  }

  stop(): void {
    throw new Error("not implemented");
  }
}
