import { describe, expect, it } from "vitest";
import { RED_DARK_STATE_MAX_LUM, RED_OTHER_STATE_MIN_UV_DISTANCE, SENSITIVITY_PRESETS } from "../../src/detection/config";
import { uvDistance } from "../../src/detection/color";
import { LuminanceTransitionDetector, RedTransitionDetector } from "../../src/detection/transitions";
import { gray, rgb, type CellColor, type Rgb } from "./synth";

const low = SENSITIVITY_PRESETS.low;

function lumDetector(cells = 1): (tMs: number, values: number[]) => { up: number[]; down: number[] } {
  const det = new LuminanceTransitionDetector(low, cells);
  return (tMs, values) => det.push(tMs, Float32Array.from(values));
}

/** Feeds one value per frame at `fps`, returns the directions emitted for cell 0. */
function series(values: number[], fps: number): string[] {
  const push = lumDetector();
  return values.map((y, k) => {
    const e = push((k * 1000) / fps, [y]);
    return e.up.length ? "up" : e.down.length ? "down" : "-";
  });
}

describe("LuminanceTransitionDetector (SPEC.md §5.4 step 1)", () => {
  it("emits a one-frame step once, only for the cell that changed", () => {
    const push = lumDetector(2);
    expect(push(0, [0, 0])).toEqual({ up: [], down: [] });
    expect(push(33.3, [1, 0])).toEqual({ up: [0], down: [] });
    expect(push(66.7, [1, 0])).toEqual({ up: [], down: [] });
    expect(push(100, [0, 0])).toEqual({ up: [], down: [0] });
  });

  it("requires directions to alternate", () => {
    expect(series([0, 0.5, 1, 1, 0.5, 0], 30)).toEqual(["-", "up", "-", "-", "down", "-"]);
  });

  it("detects a transition that completes over two frames", () => {
    // 0.06 per frame at 60 fps: no single step reaches 0.10, but two do within 66 ms.
    expect(series([0, 0.06, 0.12], 60)).toEqual(["-", "-", "up"]);
  });

  it("never fires on slow fades whose change within qualifyingMs stays below minLumDelta", () => {
    const upAndDown = (step: number, n: number) => {
      const up = Array.from({ length: n }, (_, k) => step * k);
      return [...up, ...[...up].reverse()];
    };
    // 0.03 per frame at 30 fps, and 0.02 per frame at 60 fps (0.06 within 66 ms).
    expect(series(upAndDown(0.03, 31), 30).filter((d) => d !== "-")).toEqual([]);
    expect(series(upAndDown(0.02, 46), 60).filter((d) => d !== "-")).toEqual([]);
  });

  it("uses a luminance delta threshold of 0.10 under low (just above / just below)", () => {
    expect(series([0.3, 0.405, 0.3], 30)).toEqual(["-", "up", "down"]);
    expect(series([0.3, 0.395, 0.3], 30)).toEqual(["-", "-", "-"]);
  });

  it("applies the darker-state exception (darker state must be below 0.80 under low)", () => {
    expect(series([0.79, 0.95, 0.79], 30)).toEqual(["-", "up", "down"]);
    expect(series([0.81, 0.95, 0.81], 30)).toEqual(["-", "-", "-"]);
  });

  it("treats a cut between consecutive frames as a transition even when frames are further apart than qualifyingMs", () => {
    // 15 fps: frames are 66.7 ms apart, more than low's 66 ms.
    expect(series([0, 1, 0, 1], 15)).toEqual(["-", "up", "down", "up"]);
  });

  it("forgets history and direction on reset", () => {
    const det = new LuminanceTransitionDetector(low, 1);
    det.push(0, Float32Array.of(0));
    expect(det.push(33, Float32Array.of(1)).up).toEqual([0]);
    det.reset();
    expect(det.push(66, Float32Array.of(0))).toEqual({ up: [], down: [] }); // no history to compare against
    expect(det.push(99, Float32Array.of(1)).up).toEqual([0]); // UP allowed again: last direction was cleared
  });
});

function redSeries(colors: CellColor[], fps = 30): string[] {
  const det = new RedTransitionDetector(low, 1);
  return colors.map((c, k) => {
    const e = det.push((k * 1000) / fps, {
      lum: Float32Array.of(c.lum),
      redSat: Uint8Array.of(c.redSat ? 1 : 0),
      u: Float32Array.of(c.u),
      v: Float32Array.of(c.v),
    });
    return e.up.length ? "up" : e.down.length ? "down" : "-";
  });
}

const RED: Rgb = [255, 0, 0];
const BLACK: Rgb = [0, 0, 0];

describe("RedTransitionDetector (SPEC.md §5.1, §5.4 step 1)", () => {
  it("emits into-red (up) and out-of-red (down) for red <-> black", () => {
    expect(redSeries([rgb(BLACK), rgb(RED), rgb(BLACK), rgb(RED)])).toEqual(["-", "up", "down", "up"]);
  });

  it("emits for red <-> a neutral gray (>= 0.2 away in u'v')", () => {
    expect(redSeries([gray(0.2), rgb(RED), gray(0.2)])).toEqual(["-", "up", "down"]);
  });

  it("does not emit between two saturated reds", () => {
    const dimRed = rgb([200, 0, 0]);
    expect(dimRed.redSat).toBe(true);
    expect(redSeries([dimRed, rgb(RED), dimRed, rgb(RED)])).toEqual(["-", "-", "-", "-"]);
  });

  it("does not emit when neither state is saturated red", () => {
    expect(redSeries([rgb(BLACK), rgb([255, 255, 255]), rgb(BLACK), rgb([0, 0, 255])])).toEqual(["-", "-", "-", "-"]);
  });

  it("does not emit for red <-> a non-saturated color that is < 0.2 away in u'v' and not dark", () => {
    const pink = rgb([255, 140, 130]);
    const red = rgb(RED);
    expect(pink.redSat).toBe(false);
    expect(uvDistance(red.u, red.v, pink.u, pink.v)).toBeLessThan(RED_OTHER_STATE_MIN_UV_DISTANCE);
    expect(pink.lum).toBeGreaterThan(RED_DARK_STATE_MAX_LUM);
    expect(redSeries([pink, red, pink, red])).toEqual(["-", "-", "-", "-"]);
  });

  it("counts a very dark state as different even when its chromaticity is close to red (SPEC.md §5.1)", () => {
    const nearBlackRed = rgb([14, 4, 3]);
    const red = rgb(RED);
    expect(nearBlackRed.redSat).toBe(false);
    expect(uvDistance(red.u, red.v, nearBlackRed.u, nearBlackRed.v)).toBeLessThan(RED_OTHER_STATE_MIN_UV_DISTANCE);
    expect(nearBlackRed.lum).toBeLessThan(RED_DARK_STATE_MAX_LUM);
    expect(redSeries([nearBlackRed, red, nearBlackRed])).toEqual(["-", "up", "down"]);
  });
});
