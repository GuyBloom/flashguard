// Video discovery (MutationObserver, open shadow roots) and per-video
// lifecycle. SPEC.md §5.6.

import { FlashAnalyzer } from "../detection/analyzer";
import { MAX_CONCURRENT_ANALYZERS, MIN_ANALYZABLE_CSS_PX, SENSITIVITY_PRESETS } from "../detection/config";
import type { DetectionResult, FrameSample, Geometry } from "../detection/types";
import { isHostAllowed, type Settings } from "../shared/settings";
import { DebugHud } from "./hud";
import { Intervention, InterventionHysteresis } from "./intervention";
import { VideoSampler } from "./sampler";

export type VideoState = "idle" | "analyzing" | "intervening" | "unanalyzable" | "allowed";

export interface VideoRegistryCallbacks {
  onStateChange(video: HTMLVideoElement, state: VideoState): void;
  /** "Always allow on this site" was clicked; the caller owns writing settings. */
  onAllowSiteRequested(): void;
}

/** Deep scan: <video> elements in `root` and in every open shadow root under it. SPEC.md §5.6. */
function findVideos(root: Document | ShadowRoot): HTMLVideoElement[] {
  const result: HTMLVideoElement[] = [...root.querySelectorAll("video")];
  for (const el of root.querySelectorAll("*")) {
    if (el.shadowRoot) result.push(...findVideos(el.shadowRoot));
  }
  return result;
}

class VideoController {
  readonly analyzer: FlashAnalyzer;
  readonly intervention: Intervention;
  private hud: DebugHud | null = null;
  private sampler: VideoSampler | null = null;
  private readonly hysteresis = new InterventionHysteresis();
  private readonly cleanup: Array<() => void> = [];
  private readonly frameTimes: number[] = [];

  state: VideoState = "idle";
  playing: boolean;
  visible = false;
  widthCss = 0;
  heightCss = 0;
  active = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private settings: Settings,
    private readonly onState: (state: VideoState) => void,
    onAllowSite: () => void,
  ) {
    this.analyzer = new FlashAnalyzer(settings.sensitivity);
    this.intervention = new Intervention(video, settings.mode, {
      onShowAnyway: () => this.setState("allowed"),
      onAllowSite,
    });
    this.playing = !video.paused && !video.ended;
    this.attachVideoListeners();
  }

  private attachVideoListeners(): void {
    const onPlay = (): void => {
      this.playing = true;
    };
    const onPause = (): void => {
      this.playing = false;
    };
    // seeking/emptied/loadstart: a source change or seek invalidates the
    // analyzer's running history. SPEC.md §5.6.
    const onLifecycleReset = (): void => {
      this.analyzer.reset();
      this.hysteresis.reset();
      if (this.state !== "allowed") this.setState(this.active ? "analyzing" : "idle");
    };
    const resizeObserver = new ResizeObserver(onLifecycleReset);
    resizeObserver.observe(this.video);

    this.video.addEventListener("play", onPlay);
    this.video.addEventListener("playing", onPlay);
    this.video.addEventListener("pause", onPause);
    this.video.addEventListener("ended", onPause);
    this.video.addEventListener("seeking", onLifecycleReset);
    this.video.addEventListener("emptied", onLifecycleReset);
    this.video.addEventListener("loadstart", onLifecycleReset);

    this.cleanup.push(
      () => this.video.removeEventListener("play", onPlay),
      () => this.video.removeEventListener("playing", onPlay),
      () => this.video.removeEventListener("pause", onPause),
      () => this.video.removeEventListener("ended", onPause),
      () => this.video.removeEventListener("seeking", onLifecycleReset),
      () => this.video.removeEventListener("emptied", onLifecycleReset),
      () => this.video.removeEventListener("loadstart", onLifecycleReset),
      () => resizeObserver.disconnect(),
    );
  }

  updateSettings(settings: Settings): void {
    const sensitivityChanged = settings.sensitivity !== this.settings.sensitivity;
    this.settings = settings;
    this.intervention.setMode(settings.mode);
    if (sensitivityChanged) {
      this.analyzer.setSensitivity(settings.sensitivity);
      this.hysteresis.reset();
    }
    this.syncHud();
  }

  /** Whether this video should be a candidate for analysis, independent of the concurrency cap. */
  eligible(hostAllowed: boolean): boolean {
    if (!this.settings.enabled || hostAllowed || this.state === "unanalyzable") return false;
    if (!this.playing || document.hidden || !this.visible) return false;
    const rect = this.video.getBoundingClientRect();
    this.widthCss = rect.width;
    this.heightCss = rect.height;
    return this.widthCss >= MIN_ANALYZABLE_CSS_PX && this.heightCss >= MIN_ANALYZABLE_CSS_PX;
  }

  get displayedAreaCssPx2(): number {
    return this.widthCss * this.heightCss;
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;

    if (active) {
      this.sampler = new VideoSampler(this.video, {
        onSample: (sample, geom) => this.handleSample(sample, geom),
        onUnanalyzable: (reason) => this.handleUnanalyzable(reason),
      });
      this.sampler.start();
      this.setState(this.state === "allowed" ? "allowed" : "analyzing");
    } else {
      this.sampler?.stop();
      this.sampler = null;
      this.intervention.release();
      this.hysteresis.reset();
      if (this.state !== "allowed" && this.state !== "unanalyzable") this.setState("idle");
    }
    this.syncHud();
  }

  private handleSample(sample: FrameSample, geom: Geometry): void {
    this.frameTimes.push(sample.tMs);
    if (this.frameTimes.length > 30) this.frameTimes.shift();

    const result = this.analyzer.push(sample, geom);

    if (this.state !== "allowed") {
      const shouldEngage = this.hysteresis.update(result.hazardous, sample.tMs);
      if (shouldEngage) {
        this.intervention.engage();
        this.setState("intervening");
      } else {
        this.intervention.release();
        this.setState("analyzing");
      }
    }

    this.updateHud(sample, result);
  }

  private handleUnanalyzable(reason: "tainted" | "black"): void {
    void reason;
    this.sampler = null;
    this.setState("unanalyzable");
    this.intervention.showUnanalyzable();
    this.syncHud();
  }

  private syncHud(): void {
    const wantHud = this.settings.debugHud && this.active;
    if (wantHud && !this.hud) this.hud = new DebugHud(this.video);
    if (!wantHud && this.hud) {
      this.hud.destroy();
      this.hud = null;
    }
  }

  private updateHud(sample: FrameSample, result: DetectionResult): void {
    if (!this.hud) return;
    const first = this.frameTimes[0];
    const last = this.frameTimes[this.frameTimes.length - 1];
    const fps = first !== undefined && last !== undefined && last > first ? (1000 * (this.frameTimes.length - 1)) / (last - first) : 0;
    this.hud.update({
      fps,
      cols: sample.cols,
      rows: sample.rows,
      state: this.state,
      lastResult: result,
      hazardAreaCssPx2: SENSITIVITY_PRESETS[this.settings.sensitivity].hazardAreaCssPx2,
    });
  }

  private setState(state: VideoState): void {
    if (this.state === state) return;
    this.state = state;
    this.onState(state);
  }

  destroy(): void {
    this.sampler?.stop();
    this.intervention.destroy();
    this.hud?.destroy();
    for (const fn of this.cleanup) fn();
  }
}

export class VideoRegistry {
  private readonly controllers = new Map<HTMLVideoElement, VideoController>();
  private settings: Settings;
  private mutationObserver: MutationObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private rescanScheduled = false;
  private started = false;
  private readonly onVisibilityChange = () => this.rebalance();

  constructor(
    initialSettings: Settings,
    private readonly callbacks: VideoRegistryCallbacks,
  ) {
    this.settings = initialSettings;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const controller = this.controllers.get(entry.target as HTMLVideoElement);
          if (controller) controller.visible = entry.isIntersecting;
        }
        this.rebalance();
      },
      { threshold: 0 },
    );

    // A full-document rescan on every mutation burst is simple and correct,
    // at the cost of being more work than a targeted diff on very dynamic
    // pages. Coalesced via microtask so a burst of mutations rescans once.
    this.mutationObserver = new MutationObserver(() => this.scheduleRescan());
    this.mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.scheduleRescan();
  }

  stop(): void {
    this.started = false;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    for (const controller of this.controllers.values()) controller.destroy();
    this.controllers.clear();
  }

  /** Settings changed live, without a reload. SPEC.md §7. */
  updateSettings(settings: Settings): void {
    this.settings = settings;
    for (const controller of this.controllers.values()) controller.updateSettings(settings);
    this.rebalance();
  }

  /** For the popup's status line (SPEC.md §6.2) and the message protocol. */
  getStatusCounts(): Record<VideoState, number> {
    const counts: Record<VideoState, number> = { idle: 0, analyzing: 0, intervening: 0, unanalyzable: 0, allowed: 0 };
    for (const controller of this.controllers.values()) counts[controller.state]++;
    return counts;
  }

  private scheduleRescan(): void {
    if (this.rescanScheduled) return;
    this.rescanScheduled = true;
    queueMicrotask(() => {
      this.rescanScheduled = false;
      this.rescan();
    });
  }

  private rescan(): void {
    if (!this.started) return;
    const found = new Set(findVideos(document));

    for (const [video, controller] of this.controllers) {
      if (!found.has(video)) {
        controller.destroy();
        this.intersectionObserver?.unobserve(video);
        this.controllers.delete(video);
      }
    }

    for (const video of found) {
      if (this.controllers.has(video)) continue;
      const controller = new VideoController(
        video,
        this.settings,
        (state) => this.callbacks.onStateChange(video, state),
        () => this.callbacks.onAllowSiteRequested(),
      );
      this.controllers.set(video, controller);
      this.intersectionObserver?.observe(video);
    }

    this.rebalance();
  }

  /** Caps concurrent analyzers, preferring the largest visible. SPEC.md §5.6. */
  private rebalance(): void {
    const hostAllowed = isHostAllowed(this.settings, location.hostname);
    const eligible = [...this.controllers.values()].filter((c) => c.eligible(hostAllowed));
    eligible.sort((a, b) => b.displayedAreaCssPx2 - a.displayedAreaCssPx2);
    const activeSet = new Set(eligible.slice(0, MAX_CONCURRENT_ANALYZERS));

    for (const controller of this.controllers.values()) {
      controller.setActive(activeSet.has(controller));
    }
  }
}
