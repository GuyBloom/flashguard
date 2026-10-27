import { describe, expect, it } from "vitest";
import {
  isSaturatedRed,
  relativeLuminance,
  srgbChannelToLinear,
  toUV,
  uvDistance,
} from "../../src/detection/color";
import { RED_OTHER_STATE_MIN_UV_DISTANCE } from "../../src/detection/config";

describe("srgbChannelToLinear", () => {
  it("maps the endpoints to 0 and 1", () => {
    expect(srgbChannelToLinear(0)).toBe(0);
    expect(srgbChannelToLinear(255)).toBeCloseTo(1, 10);
  });

  it("uses the linear segment at the low end", () => {
    expect(srgbChannelToLinear(10)).toBeCloseTo(10 / 255 / 12.92, 10);
  });

  it("matches known values on the power segment", () => {
    expect(srgbChannelToLinear(128)).toBeCloseTo(0.21586, 4);
    expect(srgbChannelToLinear(146)).toBeCloseTo(0.28744, 4);
    expect(srgbChannelToLinear(235)).toBeCloseTo(0.83077, 4);
  });
});

describe("relativeLuminance", () => {
  it("uses BT.709 coefficients on linear values", () => {
    expect(relativeLuminance(1, 1, 1)).toBeCloseTo(1, 10);
    expect(relativeLuminance(1, 0, 0)).toBeCloseTo(0.2126, 10);
    expect(relativeLuminance(0, 1, 0)).toBeCloseTo(0.7152, 10);
    expect(relativeLuminance(0, 0, 1)).toBeCloseTo(0.0722, 10);
  });
});

describe("isSaturatedRed", () => {
  it("is true for pure red and at exactly the 0.8 ratio", () => {
    expect(isSaturatedRed(1, 0, 0)).toBe(true);
    expect(isSaturatedRed(0.8, 0.1, 0.1)).toBe(true);
  });

  it("is false just below the ratio, for non-red colors, and for black", () => {
    expect(isSaturatedRed(0.79, 0.105, 0.105)).toBe(false);
    expect(isSaturatedRed(1, 1, 1)).toBe(false);
    expect(isSaturatedRed(0, 0, 1)).toBe(false);
    expect(isSaturatedRed(0, 0, 0)).toBe(false);
  });
});

describe("toUV / uvDistance", () => {
  it("puts white at the D65 white point", () => {
    const { u, v } = toUV(1, 1, 1);
    expect(u).toBeCloseTo(0.1978, 3);
    expect(v).toBeCloseTo(0.4683, 3);
  });

  it("puts sRGB red at its primary", () => {
    const { u, v } = toUV(1, 0, 0);
    expect(u).toBeCloseTo(0.4507, 3);
    expect(v).toBeCloseTo(0.5229, 3);
  });

  it("gives black (undefined chromaticity) the white point, so it counts as a different state from red (SPEC.md §5.1)", () => {
    const black = toUV(0, 0, 0);
    const white = toUV(1, 1, 1);
    expect(black.u).toBeCloseTo(white.u, 10);
    expect(black.v).toBeCloseTo(white.v, 10);
    const red = toUV(1, 0, 0);
    expect(uvDistance(red.u, red.v, black.u, black.v)).toBeGreaterThanOrEqual(RED_OTHER_STATE_MIN_UV_DISTANCE);
  });

  it("measures Euclidean distance", () => {
    expect(uvDistance(0, 0, 0.3, 0.4)).toBeCloseTo(0.5, 10);
  });
});
