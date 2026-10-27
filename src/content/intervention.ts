// Apply/restore the filter, the Shadow-DOM overlay, and hysteresis.
// SPEC.md §6.1.
//
// Blur alone is not an acceptable intervention — every mode must reduce the
// luminance swing below the thresholds (CLAUDE.md "Non-negotiables"), so
// `blur` always pairs brightness(0.08) with the blur filter.

import { INTERVENTION_MIN_TOGGLE_GAP_MS, INTERVENTION_SUSTAIN_MS } from "../detection/config";
import type { InterventionMode } from "../shared/settings";

const FILTERS: Record<InterventionMode, string> = {
  blur: "brightness(0.08) blur(8px)",
  dim: "brightness(0.08)",
  freeze: "brightness(0.08) blur(8px)",
};

/**
 * Pure hysteresis policy: when the intervention should be engaged, given a
 * stream of DetectionResult.hazardous values over time. No DOM — the
 * analyzer itself has no hysteresis; this is where it lives (SPEC.md §6.1).
 */
export class InterventionHysteresis {
  private lastHazardMs: number | null = null;
  private lastToggleMs: number | null = null;
  private engaged = false;

  constructor(
    private readonly sustainMs = INTERVENTION_SUSTAIN_MS,
    private readonly minToggleGapMs = INTERVENTION_MIN_TOGGLE_GAP_MS,
  ) {}

  /** Call once per DetectionResult. Returns whether the intervention should be engaged now. */
  update(hazardous: boolean, nowMs: number): boolean {
    if (hazardous) this.lastHazardMs = nowMs;

    const wants = hazardous || (this.lastHazardMs !== null && nowMs - this.lastHazardMs < this.sustainMs);

    if (wants !== this.engaged) {
      const canToggle = this.lastToggleMs === null || nowMs - this.lastToggleMs >= this.minToggleGapMs;
      if (canToggle) {
        this.engaged = wants;
        this.lastToggleMs = nowMs;
      }
    }
    return this.engaged;
  }

  /**
   * Analysis is resuming after a pause in sampling (scrolled back into view,
   * replayed, tab shown). If engaged, restart the sustain window from now so
   * the intervention holds while the analyzer rebuilds its history, instead
   * of releasing on the first non-hazardous result and re-engaging ~1s later.
   */
  resume(nowMs: number): void {
    if (this.engaged) this.lastHazardMs = nowMs;
  }

  reset(): void {
    this.lastHazardMs = null;
    this.lastToggleMs = null;
    this.engaged = false;
  }
}

export interface InterventionCallbacks {
  onShowAnyway(): void;
  onAllowSite(): void;
}

function pickOverlayParent(video: HTMLVideoElement): HTMLElement | null {
  const fsEl = document.fullscreenElement;
  if (fsEl === video) return null; // no overlay can render; rely on filter + badge + popup. SPEC.md §6.1.
  if (fsEl instanceof HTMLElement && fsEl.contains(video)) return fsEl;
  return document.body;
}

/** Builds the Shadow-DOM overlay host, positioned over `video`'s rect. */
function buildOverlayHost(video: HTMLVideoElement, state: "intervening" | "unanalyzable"): { host: HTMLDivElement; shadow: ShadowRoot } {
  const host = document.createElement("div");
  host.setAttribute("data-flashguard-state", state);
  host.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "open" }); // open in test builds, per SPEC.md §6.1
  void video;
  return { host, shadow };
}

function positionOverlay(host: HTMLDivElement, video: HTMLVideoElement): void {
  const rect = video.getBoundingClientRect();
  host.style.top = `${rect.top}px`;
  host.style.left = `${rect.left}px`;
  host.style.width = `${rect.width}px`;
  host.style.height = `${rect.height}px`;
}

const OVERLAY_STYLE = `
  :host { color-scheme: light dark; }
  .panel {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 10px; text-align: center;
    padding: 16px; box-sizing: border-box; pointer-events: auto;
    background: rgba(20, 20, 24, 0.82); color: #fff; font: 14px/1.4 system-ui, sans-serif;
  }
  .panel strong { font-size: 15px; }
  .panel p { margin: 0; max-width: 420px; opacity: 0.9; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  button {
    font: inherit; padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.12); color: #fff; cursor: pointer;
  }
  button:hover { background: rgba(255,255,255,0.22); }
  button:focus-visible { outline: 2px solid #6cf; outline-offset: 2px; }
  button.primary { background: #fff; color: #111; border-color: #fff; }
  .badge {
    position: absolute; top: 8px; left: 8px; pointer-events: auto;
    background: rgba(20,20,24,0.85); color: #fff; font: 12px/1.3 system-ui, sans-serif;
    padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; gap: 6px;
  }
  .badge button { padding: 2px 8px; font-size: 11px; }
`;

export class Intervention {
  private mode: InterventionMode;
  private previousFilter: { value: string; priority: string } | null = null;
  private wasPlayingBeforeFreeze = false;
  private overlayHost: HTMLDivElement | null = null;
  private reposition: (() => void) | null = null;
  private engaged = false;
  private allowedForThisVideo = false; // "Show anyway", sticky until page reload. SPEC.md §6.1.

  constructor(
    private readonly video: HTMLVideoElement,
    mode: InterventionMode,
    private readonly callbacks: InterventionCallbacks,
  ) {
    this.mode = mode;
  }

  setMode(mode: InterventionMode): void {
    this.mode = mode;
    if (this.engaged) this.applyFilter(); // live update without a toggle. SPEC.md §7.
  }

  get isAllowed(): boolean {
    return this.allowedForThisVideo;
  }

  /** Apply the filter + overlay. Idempotent. No-op if the user chose "Show anyway". */
  engage(): void {
    if (this.allowedForThisVideo || this.engaged) return;
    this.engaged = true;
    this.applyFilter();

    if (this.mode === "freeze") {
      this.wasPlayingBeforeFreeze = !this.video.paused;
      this.video.pause();
    }

    const parent = pickOverlayParent(this.video);
    if (!parent) return; // fullscreen video itself; filter + badge carry this. SPEC.md §6.1.

    const { host, shadow } = buildOverlayHost(this.video, "intervening");
    const style = document.createElement("style");
    style.textContent = OVERLAY_STYLE;
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "status");
    panel.innerHTML = `
      <strong>Flashing content hidden</strong>
      <p>FlashGuard detected a potentially hazardous flashing pattern and reduced exposure to this video.</p>
      <div class="actions">
        <button type="button" class="show-anyway">Show anyway</button>
        <button type="button" class="allow-site primary">Always allow on this site</button>
      </div>
    `;
    panel.querySelector(".show-anyway")?.addEventListener("click", () => this.showAnyway());
    panel.querySelector(".allow-site")?.addEventListener("click", () => this.callbacks.onAllowSite());
    shadow.append(style, panel);

    parent.appendChild(host);
    this.overlayHost = host;
    this.trackPosition(host);
  }

  /** Restore the video's original inline filter and remove the overlay. */
  release(): void {
    if (!this.engaged) return;
    this.engaged = false;
    this.restoreFilter();
    this.teardownOverlay();
    if (this.mode === "freeze" && this.wasPlayingBeforeFreeze) {
      this.video.play().catch(() => undefined); // autoplay may be blocked; not FlashGuard's concern here
    }
  }

  /** "Show anyway": bypass intervention for this video until the page reloads. */
  private showAnyway(): void {
    this.allowedForThisVideo = true;
    this.release();
    this.callbacks.onShowAnyway();
  }

  /** "FlashGuard can't check this video" indicator + manual hide control. SPEC.md §5.7. */
  showUnanalyzable(): void {
    const parent = pickOverlayParent(this.video);
    if (!parent) return;

    const { host, shadow } = buildOverlayHost(this.video, "unanalyzable");
    const style = document.createElement("style");
    style.textContent = OVERLAY_STYLE;
    const badge = document.createElement("div");
    badge.className = "badge";
    badge.setAttribute("role", "status");
    badge.innerHTML = `<span>⚠️ Can't check this video</span><button type="button" class="hide">Hide</button>`;
    let hidden = false;
    badge.querySelector(".hide")?.addEventListener("click", (event) => {
      hidden = !hidden;
      const button = event.currentTarget as HTMLButtonElement;
      this.video.style.setProperty("filter", hidden ? FILTERS.blur : (this.previousFilter?.value ?? ""), "important");
      button.textContent = hidden ? "Show" : "Hide";
    });
    shadow.append(style, badge);

    parent.appendChild(host);
    this.overlayHost = host;
    this.trackPosition(host);
  }

  destroy(): void {
    this.restoreFilter();
    this.teardownOverlay();
  }

  private applyFilter(): void {
    if (!this.previousFilter) {
      this.previousFilter = { value: this.video.style.filter, priority: this.video.style.getPropertyPriority("filter") };
    }
    this.video.style.setProperty("filter", FILTERS[this.mode], "important");
  }

  private restoreFilter(): void {
    if (!this.previousFilter) return;
    if (this.previousFilter.value) {
      this.video.style.setProperty("filter", this.previousFilter.value, this.previousFilter.priority);
    } else {
      this.video.style.removeProperty("filter");
    }
    this.previousFilter = null;
  }

  private trackPosition(host: HTMLDivElement): void {
    const update = () => positionOverlay(host, this.video);
    update();
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    ro.observe(this.video);
    this.reposition = () => {
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }

  private teardownOverlay(): void {
    this.reposition?.();
    this.reposition = null;
    this.overlayHost?.remove();
    this.overlayHost = null;
  }
}
