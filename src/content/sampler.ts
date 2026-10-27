// requestVideoFrameCallback -> FrameSample. SPEC.md §5.2.
//
// Fires once per presented frame — never polls at a fixed rate (CLAUDE.md
// "Non-negotiables"). Gaps are not interpolated; FlashAnalyzer.push()
// already resets itself on a gap > MAX_GAP_MS or a grid-size change (see
// analyzer.ts), so the sampler doesn't need to call reset() itself.

import { relativeLuminance, srgbChannelToLinear, isSaturatedRed, toUV } from "../detection/color";
import {
  BLACK_FRAME_STREAK_FOR_UNANALYZABLE,
  SAMPLER_CELL_AREA_TARGET_CSS_PX2,
  SAMPLER_MAX_COLS,
  SAMPLER_MAX_ROWS,
  SAMPLER_MIN_COLS,
  SAMPLER_MIN_ROWS,
} from "../detection/config";
import type { FrameSample, Geometry } from "../detection/types";

/**
 * Chooses cols x rows from the displayed CSS size so no cell exceeds
 * SAMPLER_CELL_AREA_TARGET_CSS_PX2, clamped to the configured bounds.
 * Pure function — SPEC.md §5.2.
 */
export function computeGrid(widthCss: number, heightCss: number): { cols: number; rows: number } {
  const totalArea = Math.max(widthCss, 1) * Math.max(heightCss, 1);
  const idealCells = Math.max(totalArea / SAMPLER_CELL_AREA_TARGET_CSS_PX2, 1);
  const aspect = widthCss / heightCss;

  const cols = Math.round(Math.sqrt(idealCells * aspect));
  const rows = Math.round(Math.sqrt(idealCells / aspect));

  return {
    cols: Math.min(SAMPLER_MAX_COLS, Math.max(SAMPLER_MIN_COLS, cols)),
    rows: Math.min(SAMPLER_MAX_ROWS, Math.max(SAMPLER_MIN_ROWS, rows)),
  };
}

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function createCanvas(cols: number, rows: number): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: Canvas2D } {
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(cols, rows) : document.createElement("canvas");
  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = cols;
    canvas.height = rows;
  }
  const ctx = canvas.getContext("2d", { willReadFrequently: true, alpha: false }) as Canvas2D | null;
  if (!ctx) throw new Error("FlashGuard: 2D canvas context unavailable");
  ctx.imageSmoothingEnabled = true;
  // imageSmoothingQuality isn't on the OffscreenCanvasRenderingContext2D type
  // in all lib.dom versions; set it defensively. SPEC.md §5.2.
  (ctx as { imageSmoothingQuality?: ImageSmoothingQuality }).imageSmoothingQuality = "high";
  return { canvas, ctx };
}

export interface SamplerCallbacks {
  onSample(sample: FrameSample, geom: Geometry): void;
  /** Canvas read throws SecurityError, or frames are persistently all-black. SPEC.md §5.7. */
  onUnanalyzable(reason: "tainted" | "black"): void;
}

export class VideoSampler {
  private cols = 0;
  private rows = 0;
  private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private ctx: Canvas2D | null = null;
  private handle: number | null = null;
  private stopped = false;
  private blackStreak = 0;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly callbacks: SamplerCallbacks,
  ) {}

  start(): void {
    this.stopped = false;
    this.scheduleNext();
  }

  stop(): void {
    this.stopped = true;
    if (this.handle !== null && "cancelVideoFrameCallback" in this.video) {
      this.video.cancelVideoFrameCallback(this.handle);
    }
    this.handle = null;
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    this.handle = this.video.requestVideoFrameCallback((now, metadata) => {
      this.onFrame(now, metadata);
    });
  }

  private ensureGrid(cols: number, rows: number): void {
    if (this.cols === cols && this.rows === rows && this.canvas) return;
    this.cols = cols;
    this.rows = rows;
    const { canvas, ctx } = createCanvas(cols, rows);
    this.canvas = canvas;
    this.ctx = ctx;
  }

  private onFrame(now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata): void {
    if (this.stopped) return;
    this.scheduleNext(); // reschedule first so a throw below doesn't stop the loop silently

    const rect = this.video.getBoundingClientRect();
    const geom: Geometry = { widthCss: rect.width, heightCss: rect.height };
    if (geom.widthCss <= 0 || geom.heightCss <= 0) return;

    const { cols, rows } = computeGrid(geom.widthCss, geom.heightCss);
    this.ensureGrid(cols, rows);
    const ctx = this.ctx;
    if (!ctx) return;

    let pixels: Uint8ClampedArray;
    try {
      ctx.drawImage(this.video, 0, 0, cols, rows);
      pixels = ctx.getImageData(0, 0, cols, rows).data;
    } catch {
      // SecurityError: drawing tainted this canvas (cross-origin video without CORS). SPEC.md §5.7.
      this.stop();
      this.callbacks.onUnanalyzable("tainted");
      return;
    }

    // Wall-clock display time, not mediaTime, so the rate stays correct when
    // playbackRate != 1. SPEC.md §5.2.
    const tMs = metadata.expectedDisplayTime || now;

    const cells = cols * rows;
    const lum = new Float32Array(cells);
    const redSat = new Uint8Array(cells);
    const u = new Float32Array(cells);
    const v = new Float32Array(cells);

    let maxLum = 0;
    for (let i = 0; i < cells; i++) {
      const p = i * 4;
      // Averaging sRGB bytes (what drawImage's downscale does) before
      // linearizing introduces a small bias vs. averaging in linear light.
      // SPEC.md §5.2.
      const r = srgbChannelToLinear(pixels[p]!);
      const g = srgbChannelToLinear(pixels[p + 1]!);
      const b = srgbChannelToLinear(pixels[p + 2]!);

      const y = relativeLuminance(r, g, b);
      lum[i] = y;
      if (y > maxLum) maxLum = y;
      redSat[i] = isSaturatedRed(r, g, b) ? 1 : 0;
      const uv = toUV(r, g, b);
      u[i] = uv.u;
      v[i] = uv.v;
    }

    // Persistently all-black frames likely mean protected media painted
    // black instead of throwing. SPEC.md §5.7.
    if (maxLum <= 0) {
      this.blackStreak++;
      if (this.blackStreak >= BLACK_FRAME_STREAK_FOR_UNANALYZABLE) {
        this.stop();
        this.callbacks.onUnanalyzable("black");
        return;
      }
    } else {
      this.blackStreak = 0;
    }

    this.callbacks.onSample({ tMs, cols, rows, lum, redSat, u, v }, geom);
  }
}
