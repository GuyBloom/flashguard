// sRGB -> linear, relative luminance, saturated-red, CIE 1976 UCS (u', v').
// SPEC.md §3, §5.1. Pure functions, no DOM.

import { RED_SATURATION_RATIO } from "./config";

/** Converts one gamma-encoded sRGB channel (0..255) to linear light (0..1). IEC 61966-2-1. */
export function srgbChannelToLinear(value8bit: number): number {
  const c = value8bit / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * BT.709 relative luminance from linear R, G, B (each 0..1).
 *
 * Note: averaging cell pixels in gamma space before this conversion (as
 * sampler.ts does when downsampling) introduces a small bias — see
 * SPEC.md §5.2.
 */
export function relativeLuminance(rLinear: number, gLinear: number, bLinear: number): number {
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/** True if R/(R+G+B) >= RED_SATURATION_RATIO, on linearized values. SPEC.md §5.1. */
export function isSaturatedRed(rLinear: number, gLinear: number, bLinear: number): boolean {
  const sum = rLinear + gLinear + bLinear;
  return sum > 0 && rLinear / sum >= RED_SATURATION_RATIO;
}

/**
 * CIE 1976 UCS (u', v') from linear R, G, B, via sRGB -> XYZ (D65).
 *
 * Black has no defined chromaticity; it gets the D65 white point, so a black
 * state is >= 0.2 from saturated red and counts as a different state
 * (SPEC.md §5.1).
 */
export function toUV(rLinear: number, gLinear: number, bLinear: number): { u: number; v: number } {
  let x = 0.4124 * rLinear + 0.3576 * gLinear + 0.1805 * bLinear;
  let y = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  let z = 0.0193 * rLinear + 0.1192 * gLinear + 0.9505 * bLinear;
  if (x + 15 * y + 3 * z <= 0) {
    x = 0.9505;
    y = 1;
    z = 1.089;
  }
  const d = x + 15 * y + 3 * z;
  return { u: (4 * x) / d, v: (9 * y) / d };
}

/** Euclidean distance between two (u', v') points. */
export function uvDistance(u1: number, v1: number, u2: number, v2: number): number {
  return Math.hypot(u1 - u2, v1 - v2);
}
