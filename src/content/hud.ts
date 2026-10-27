// Debug HUD (dev setting only). SPEC.md §6.4.
//
// Per analyzed video, shows sampled fps, grid size, transitions in window,
// peak flashing area (px² and % of threshold), and state. Main calibration
// tool — our biggest technical risk, per SPEC.md §6.4.

import type { DetectionResult } from "../detection/types";
import type { VideoState } from "./video-registry";

export interface HudStats {
  fps: number;
  cols: number;
  rows: number;
  state: VideoState;
  lastResult: DetectionResult | null;
  hazardAreaCssPx2: number;
}

const HUD_STYLE = `
  :host { all: initial; }
  .panel {
    position: absolute; top: 4px; right: 4px; z-index: 2147483646;
    background: rgba(0,0,0,0.75); color: #baffc9; font: 11px/1.4 ui-monospace, monospace;
    padding: 6px 8px; border-radius: 4px; white-space: pre; pointer-events: none;
  }
`;

export class DebugHud {
  private readonly host: HTMLDivElement;
  private readonly panel: HTMLPreElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly reposition = () => this.position();

  constructor(private readonly video: HTMLVideoElement) {
    this.host = document.createElement("div");
    this.host.setAttribute("data-flashguard-hud", "");
    this.host.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;";
    const shadow = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = HUD_STYLE;
    const panel = document.createElement("pre");
    panel.className = "panel";
    shadow.append(style, panel);
    this.panel = panel;

    document.body.appendChild(this.host);
    this.resizeObserver = new ResizeObserver(this.reposition);
    this.resizeObserver.observe(video);
    window.addEventListener("scroll", this.reposition, { passive: true, capture: true });
    window.addEventListener("resize", this.reposition);
    this.position();
  }

  update(stats: HudStats): void {
    const area = stats.lastResult?.flashingAreaCssPx2 ?? 0;
    const pct = stats.hazardAreaCssPx2 > 0 ? ((area / stats.hazardAreaCssPx2) * 100).toFixed(0) : "0";
    this.panel.textContent = [
      `FlashGuard HUD`,
      `fps: ${stats.fps.toFixed(1)}`,
      `grid: ${stats.cols}x${stats.rows}`,
      `state: ${stats.state}`,
      `transitions/win: ${stats.lastResult?.transitionsInWindow ?? 0}`,
      `peak area: ${area.toFixed(0)}px² (${pct}% of threshold)`,
      `reason: ${stats.lastResult?.reason ?? "none"}`,
    ].join("\n");
  }

  private position(): void {
    const rect = this.video.getBoundingClientRect();
    this.host.style.top = `${rect.top}px`;
    this.host.style.left = `${rect.left}px`;
    this.host.style.width = `${rect.width}px`;
    this.host.style.height = `${rect.height}px`;
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    window.removeEventListener("scroll", this.reposition, { capture: true });
    window.removeEventListener("resize", this.reposition);
    this.host.remove();
  }
}
