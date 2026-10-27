import { describe, expect, it } from "vitest";
import { maxWindowArea, SyncAggregator, WindowCounter, type AggregateEvent } from "../../src/detection/aggregate";
import { SENSITIVITY_PRESETS } from "../../src/detection/config";

const low = SENSITIVITY_PRESETS.low;

function mask(cols: number, rows: number, on: Array<[number, number]>): Uint8Array {
  const m = new Uint8Array(cols * rows);
  for (const [x, y] of on) m[y * cols + x] = 1;
  return m;
}

describe("maxWindowArea (SPEC.md §5.4 step 2)", () => {
  // 4x4 grid on 400x400 CSS px: each cell is 100x100 = 10,000 px².
  const geom = { widthCss: 400, heightCss: 400 };

  it("finds the window with the most flashing cells", () => {
    const m = mask(4, 4, [[0, 0], [1, 0], [3, 3]]);
    expect(maxWindowArea(m, 4, 4, geom, { width: 200, height: 200 })).toBe(20_000);
  });

  it("counts every cell when the window covers the whole video", () => {
    const all = new Uint8Array(16).fill(1);
    expect(maxWindowArea(all, 4, 4, geom, { width: 400, height: 400 })).toBe(160_000);
  });

  it("clamps the window to the video when the video is smaller (threshold stays absolute)", () => {
    const all = new Uint8Array(6).fill(1);
    expect(maxWindowArea(all, 3, 2, { widthCss: 300, heightCss: 200 }, { width: 416, height: 416 })).toBe(60_000);
  });

  it("rounds a window that covers part of a cell up to whole cells (conservative)", () => {
    // 10x1 cells of 100x100; a 250-px window spans 2.5 cells -> 3.
    const all = new Uint8Array(10).fill(1);
    expect(maxWindowArea(all, 10, 1, { widthCss: 1000, heightCss: 100 }, { width: 250, height: 250 })).toBe(30_000);
  });

  it("returns 0 for an empty mask", () => {
    expect(maxWindowArea(new Uint8Array(16), 4, 4, geom, { width: 200, height: 200 })).toBe(0);
  });
});

describe("SyncAggregator (SPEC.md §5.4 step 2)", () => {
  // 2x1 cells on 400x200: each cell is 40,000 px², below low's 43,264; both together are 80,000.
  const geom = { widthCss: 400, heightCss: 200 };
  const none: number[] = [];

  it("sums same-direction cells emitting within 20 ms into one event", () => {
    const agg = new SyncAggregator(low);
    expect(agg.push(0, { up: [0], down: none }, 2, 1, geom).qualified).toEqual([]);
    expect(agg.push(16.7, { up: [1], down: none }, 2, 1, geom).qualified).toEqual([
      { tMs: 0, direction: "up", areaCssPx2: 80_000 },
    ]);
  });

  it("keeps cells emitting more than 20 ms apart as separate events", () => {
    const agg = new SyncAggregator(low);
    expect(agg.push(0, { up: [0], down: none }, 2, 1, geom).qualified).toEqual([]);
    expect(agg.push(33.3, { up: [1], down: none }, 2, 1, geom).qualified).toEqual([]);
  });

  it("never sums opposite directions", () => {
    const agg = new SyncAggregator(low);
    expect(agg.push(0, { up: [0], down: [1] }, 2, 1, geom).qualified).toEqual([]);
  });

  it("reports a qualifying aggregate only once", () => {
    const agg = new SyncAggregator(low);
    expect(agg.push(0, { up: [0, 1], down: none }, 2, 1, geom).qualified).toHaveLength(1);
    expect(agg.push(10, { up: [0, 1], down: none }, 2, 1, geom).qualified).toEqual([]);
  });

  it("reports the area of non-qualifying aggregates as peak area (for the HUD)", () => {
    const agg = new SyncAggregator(low);
    expect(agg.push(0, { up: [0], down: none }, 2, 1, geom).peakAreaCssPx2).toBe(40_000);
  });
});

describe("WindowCounter (SPEC.md §5.4 step 3)", () => {
  const ev = (tMs: number, direction: "up" | "down"): AggregateEvent => ({ tMs, direction, areaCssPx2: 1 });

  it("counts a 3 Hz square wave's 7 edges, exactly 1000 ms apart, as 6 (safe boundary, SPEC.md §5.1)", () => {
    const c = new WindowCounter();
    for (let k = 0; k <= 6; k++) c.push(ev((k * 1000) / 6, k % 2 ? "down" : "up"));
    expect(c.count(1000)).toBe(6);
  });

  it("counts 7 alternating edges less than 1000 ms apart as 7", () => {
    const c = new WindowCounter();
    for (let k = 0; k <= 6; k++) c.push(ev(k * 166, k % 2 ? "down" : "up"));
    expect(c.count(996)).toBe(7);
  });

  it("merges consecutive same-direction events", () => {
    const c = new WindowCounter();
    c.push(ev(0, "up"));
    c.push(ev(10, "up"));
    c.push(ev(20, "down"));
    expect(c.count(20)).toBe(2);
  });

  it("drops events that have aged out of the 1 s window, and clears on reset", () => {
    const c = new WindowCounter();
    c.push(ev(0, "up"));
    c.push(ev(500, "down"));
    expect(c.count(999)).toBe(2);
    expect(c.count(1200)).toBe(1);
    c.reset();
    expect(c.count(1200)).toBe(0);
  });
});
