// Synthetic FrameSample generators for detection unit tests. SPEC.md §9.1.

import { isSaturatedRed, relativeLuminance, srgbChannelToLinear, toUV } from "../../src/detection/color";
import { FlashAnalyzer } from "../../src/detection/analyzer";
import type { FrameSample, Geometry, HazardReason } from "../../src/detection/types";

export interface CellColor {
  lum: number;
  redSat: boolean;
  u: number;
  v: number;
}

export type Rgb = readonly [number, number, number];

/** A cell's values for an 8-bit sRGB color, computed the way the sampler will. */
export function rgb([r8, g8, b8]: Rgb): CellColor {
  const r = srgbChannelToLinear(r8);
  const g = srgbChannelToLinear(g8);
  const b = srgbChannelToLinear(b8);
  return { lum: relativeLuminance(r, g, b), redSat: isSaturatedRed(r, g, b), ...toUV(r, g, b) };
}

const WHITE_UV = toUV(1, 1, 1);

/** A neutral gray with the given relative luminance (0..1). */
export function gray(lum: number): CellColor {
  return { lum, redSat: false, u: WHITE_UV.u, v: WHITE_UV.v };
}

/** 8-bit sRGB gray, e.g. srgbGray(128). */
export function srgbGray(level8: number): CellColor {
  return rgb([level8, level8, level8]);
}

export interface FramesOptions {
  fps: number;
  durationMs: number;
  cols: number;
  rows: number;
  /** Color of cell (x, y) on frame k. */
  cell: (k: number, x: number, y: number) => CellColor;
}

export function frames({ fps, durationMs, cols, rows, cell }: FramesOptions): FrameSample[] {
  const out: FrameSample[] = [];
  const count = Math.floor((durationMs * fps) / 1000);
  for (let k = 0; k < count; k++) {
    const n = cols * rows;
    const sample: FrameSample = {
      tMs: (k * 1000) / fps,
      cols,
      rows,
      lum: new Float32Array(n),
      redSat: new Uint8Array(n),
      u: new Float32Array(n),
      v: new Float32Array(n),
    };
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const c = cell(k, x, y);
        sample.lum[i] = c.lum;
        sample.redSat[i] = c.redSat ? 1 : 0;
        sample.u[i] = c.u;
        sample.v[i] = c.v;
      }
    }
    out.push(sample);
  }
  return out;
}

/**
 * Phase (0 or 1) of a square wave at frame k. Integer arithmetic for integer
 * hz/fps, so edges land on exact frames (the 3 Hz boundary depends on it).
 */
export function squarePhase(hz: number, fps: number, k: number): 0 | 1 {
  return (Math.floor((2 * hz * k) / fps) % 2) as 0 | 1;
}

/** Triangle wave 0..1..0 at frame k, starting at 0. */
export function trianglePhase(hz: number, fps: number, k: number): number {
  const p = ((hz * k) / fps) % 1;
  return p < 0.5 ? 2 * p : 2 - 2 * p;
}

/** Whether cell (x, y)'s center lies inside a CSS-px rect [x0, x1) x [y0, y1). */
export function cellInRect(
  x: number,
  y: number,
  cols: number,
  rows: number,
  geom: Geometry,
  rect: { x0: number; x1: number; y0: number; y1: number },
): boolean {
  const cx = ((x + 0.5) * geom.widthCss) / cols;
  const cy = ((y + 0.5) * geom.heightCss) / rows;
  return cx >= rect.x0 && cx < rect.x1 && cy >= rect.y0 && cy < rect.y1;
}

export interface RunSummary {
  hazardous: boolean;
  firstHazardMs: number | null;
  reasons: Set<HazardReason>;
  maxTransitionsInWindow: number;
  maxFlashingAreaCssPx2: number;
}

export function run(analyzer: FlashAnalyzer, samples: readonly FrameSample[], geom: Geometry): RunSummary {
  const summary: RunSummary = {
    hazardous: false,
    firstHazardMs: null,
    reasons: new Set(),
    maxTransitionsInWindow: 0,
    maxFlashingAreaCssPx2: 0,
  };
  for (const s of samples) {
    const r = analyzer.push(s, geom);
    if (r.hazardous) {
      summary.hazardous = true;
      summary.firstHazardMs ??= s.tMs;
      summary.reasons.add(r.reason);
    }
    summary.maxTransitionsInWindow = Math.max(summary.maxTransitionsInWindow, r.transitionsInWindow);
    summary.maxFlashingAreaCssPx2 = Math.max(summary.maxFlashingAreaCssPx2, r.flashingAreaCssPx2);
  }
  return summary;
}
