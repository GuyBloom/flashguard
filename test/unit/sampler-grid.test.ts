import { describe, expect, it } from "vitest";
import { computeGrid } from "../../src/content/sampler";
import { SAMPLER_CELL_AREA_TARGET_CSS_PX2 } from "../../src/detection/config";

describe("computeGrid (SPEC.md §5.2)", () => {
  it("floors at 16x9 for a small 64x64 video", () => {
    expect(computeGrid(64, 64)).toEqual({ cols: 16, rows: 9 });
  });

  it("caps at 96x54 for a very large video", () => {
    expect(computeGrid(3840, 2160)).toEqual({ cols: 96, rows: 54 });
  });

  it("keeps the video's aspect ratio for a size in between the bounds", () => {
    const { cols, rows } = computeGrid(640, 480); // 4:3
    expect(cols / rows).toBeCloseTo(640 / 480, 1);
  });

  it("keeps every cell at or below the target area for 640x480", () => {
    const { cols, rows } = computeGrid(640, 480);
    const cellArea = (640 / cols) * (480 / rows);
    expect(cellArea).toBeLessThanOrEqual(SAMPLER_CELL_AREA_TARGET_CSS_PX2 * 1.1); // rounding slack
  });
});
