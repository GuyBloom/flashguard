// sRGB -> linear, relative luminance, saturated-red, CIE 1976 UCS (u', v').
// SPEC.md §3, §5.1. Pure functions, no DOM.
//
// TODO(build order step 2): implement. Stubs below throw so callers and
// tests fail loudly instead of silently passing. Do not return plausible
// fake values here — see CLAUDE.md "never loosen a threshold or weaken a
// test to make it pass".

/** Converts one gamma-encoded sRGB channel (0..255) to linear light (0..1). */
export function srgbChannelToLinear(_value8bit: number): number {
  throw new Error("not implemented");
}

/**
 * BT.709 relative luminance from linear R, G, B (each 0..1).
 *
 * Note: averaging cell pixels in gamma space before this conversion (as
 * sampler.ts does when downsampling) introduces a small bias — see
 * SPEC.md §5.2.
 */
export function relativeLuminance(_rLinear: number, _gLinear: number, _bLinear: number): number {
  throw new Error("not implemented");
}

/** True if R/(R+G+B) >= RED_SATURATION_RATIO, on linearized values. SPEC.md §5.1. */
export function isSaturatedRed(_rLinear: number, _gLinear: number, _bLinear: number): boolean {
  throw new Error("not implemented");
}

/** CIE 1976 UCS (u', v') from linear R, G, B. */
export function toUV(_rLinear: number, _gLinear: number, _bLinear: number): { u: number; v: number } {
  throw new Error("not implemented");
}

/** Euclidean distance between two (u', v') points. */
export function uvDistance(_u1: number, _v1: number, _u2: number, _v2: number): number {
  throw new Error("not implemented");
}
