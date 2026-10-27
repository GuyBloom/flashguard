// Public types for the detection engine. SPEC.md §5.3.
//
// This module is PURE: no DOM, no chrome.* APIs, no imports from other
// layers. See CLAUDE.md "Non-negotiables".

/** UI labels: Low / Balanced / High. See SPEC.md §5.5. */
export type Sensitivity = "low" | "balanced" | "high";

/** One sampled, downsampled video frame, produced by content/sampler.ts. */
export interface FrameSample {
  /** Wall-clock display time, monotonic, ms. Not video mediaTime. */
  tMs: number;
  cols: number;
  rows: number;
  /** Relative luminance 0..1 per cell, linear light, row-major. */
  lum: Float32Array;
  /** 1 if the cell is a saturated-red state, else 0. */
  redSat: Uint8Array;
  /** CIE 1976 UCS per cell. */
  u: Float32Array;
  v: Float32Array;
}

/** The video's displayed geometry, in CSS pixels. */
export interface Geometry {
  widthCss: number;
  heightCss: number;
}

export type HazardReason = "none" | "luminance" | "red" | "both";

export interface DetectionResult {
  hazardous: boolean;
  reason: HazardReason;
  /** Area-qualified, alternating transitions counted in the current window. */
  transitionsInWindow: number;
  /** Peak concurrent flashing area, CSS px². Debug/HUD only. */
  flashingAreaCssPx2: number;
}

export type TransitionDirection = "up" | "down";
