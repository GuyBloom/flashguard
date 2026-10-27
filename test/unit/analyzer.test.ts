// FlashAnalyzer end to end on synthetic series. SPEC.md §9.1.

import { describe, expect, it } from "vitest";
import { FlashAnalyzer } from "../../src/detection/analyzer";
import type { FrameSample, Geometry, Sensitivity } from "../../src/detection/types";
import {
  cellInRect,
  frames,
  gray,
  rgb,
  run,
  squarePhase,
  srgbGray,
  trianglePhase,
  type CellColor,
} from "./synth";

const VIDEO: Geometry = { widthCss: 640, heightCss: 480 };

/** Full-frame square wave between two cell colors. 16x12 grid (40x40 CSS px cells). */
function fullFrameSquare(hz: number, fps: number, lo: CellColor, hi: CellColor, durationMs = 3000): FrameSample[] {
  return frames({ fps, durationMs, cols: 16, rows: 12, cell: (k) => (squarePhase(hz, fps, k) ? lo : hi) });
}

function analyze(samples: FrameSample[], sensitivity: Sensitivity = "low", geom: Geometry = VIDEO) {
  return run(new FlashAnalyzer(sensitivity), samples, geom);
}

const BLACK = gray(0);
const WHITE = gray(1);

describe("frequency sweep, full-frame black/white at 60 fps", () => {
  const hzs = Array.from({ length: 30 }, (_, i) => i + 1);

  it.each(hzs)("%i Hz is hazardous iff > 3 flashes/s (low)", (hz) => {
    expect(analyze(fullFrameSquare(hz, 60, BLACK, WHITE)).hazardous).toBe(hz >= 4);
  });

  it.each([16, 20, 24])("%i Hz is detected at every sensitivity (aliasing regression, SPEC.md §4)", (hz) => {
    for (const s of ["low", "balanced", "high"] as const) {
      expect(analyze(fullFrameSquare(hz, 60, BLACK, WHITE), s).hazardous).toBe(true);
    }
  });
});

describe("3 Hz boundary", () => {
  it.each([30, 60])("3 Hz at %i fps is not hazardous (low)", (fps) => {
    const r = analyze(fullFrameSquare(3, fps, BLACK, WHITE));
    expect(r.hazardous).toBe(false);
    expect(r.maxTransitionsInWindow).toBe(6);
  });

  it.each([30, 60])("4 Hz at %i fps is hazardous (low)", (fps) => {
    expect(analyze(fullFrameSquare(4, fps, BLACK, WHITE)).hazardous).toBe(true);
  });
});

describe("luminance thresholds (low)", () => {
  it("flags a 5 Hz flash with delta just above 0.10", () => {
    expect(analyze(fullFrameSquare(5, 30, gray(0.3), gray(0.405))).hazardous).toBe(true);
  });

  it("ignores a 5 Hz flash with delta just below 0.10", () => {
    expect(analyze(fullFrameSquare(5, 30, gray(0.3), gray(0.395))).hazardous).toBe(false);
  });

  it("flags a bright flash whose darker state is just below 0.80", () => {
    expect(analyze(fullFrameSquare(5, 30, gray(0.79), gray(0.95))).hazardous).toBe(true);
  });

  it("ignores a bright flash whose darker state is at or above 0.80 (darker-state exception)", () => {
    expect(analyze(fullFrameSquare(5, 30, gray(0.81), gray(0.95))).hazardous).toBe(false);
  });

  it("matches clips S6 and S7 under low (sRGB 128<->146, 235<->255)", () => {
    expect(analyze(fullFrameSquare(5, 30, srgbGray(128), srgbGray(146))).hazardous).toBe(false);
    expect(analyze(fullFrameSquare(5, 30, srgbGray(235), srgbGray(255))).hazardous).toBe(false);
  });
});

describe("flashing area", () => {
  // 64x48 grid on 640x480: 10x10 CSS px cells.
  function region(widthCss: number, heightCss: number, hz = 5, fps = 30): FrameSample[] {
    const rect = { x0: 0, x1: widthCss, y0: 0, y1: heightCss };
    const bg = gray(0.2);
    return frames({
      fps,
      durationMs: 3000,
      cols: 64,
      rows: 48,
      cell: (k, x, y) => (cellInRect(x, y, 64, 48, VIDEO, rect) ? (squarePhase(hz, fps, k) ? BLACK : WHITE) : bg),
    });
  }

  it("flags a region just above 43,264 px² (210x210 = 44,100)", () => {
    expect(analyze(region(210, 210)).hazardous).toBe(true);
  });

  it("ignores a region just below 43,264 px² (200x210 = 42,000)", () => {
    expect(analyze(region(200, 210)).hazardous).toBe(false);
  });

  it("H9: 200x150 at 10 Hz is safe under low and hazardous under balanced", () => {
    expect(analyze(region(200, 150, 10)).hazardous).toBe(false);
    expect(analyze(region(200, 150, 10), "balanced").hazardous).toBe(true);
  });

  it("S8/S9: 160x120 and 80x80 regions at 5 Hz are safe under low", () => {
    expect(analyze(region(160, 120)).hazardous).toBe(false);
    expect(analyze(region(80, 80)).hazardous).toBe(false);
  });

  it("never flags a video whose whole area is below the threshold (200x150 = 30,000 px²)", () => {
    const small = { widthCss: 200, heightCss: 150 };
    const samples = frames({ fps: 30, durationMs: 3000, cols: 20, rows: 15, cell: (k) => (squarePhase(5, 30, k) ? BLACK : WHITE) });
    expect(analyze(samples, "low", small).hazardous).toBe(false);
  });

  it("flags a video smaller than the window when its flashing area still reaches the threshold (300x200 = 60,000 px²)", () => {
    const small = { widthCss: 300, heightCss: 200 };
    const samples = frames({ fps: 30, durationMs: 3000, cols: 30, rows: 20, cell: (k) => (squarePhase(5, 30, k) ? BLACK : WHITE) });
    expect(analyze(samples, "low", small).hazardous).toBe(true);
  });
});

describe("transition speed", () => {
  it("flags a 5 Hz soft-edged square with 2-frame ramps at 60 fps (H8)", () => {
    // Half period is 6 frames: hold 4, ramp over 2.
    const levels = [0, 0, 0, 0, 0.5, 1, 1, 1, 1, 1, 0.5, 0];
    const samples = frames({ fps: 60, durationMs: 3000, cols: 16, rows: 12, cell: (k) => gray(levels[k % 12]!) });
    expect(analyze(samples).hazardous).toBe(true);
  });

  it("flags a 4 Hz triangle in sRGB at 120 fps (H7)", () => {
    const samples = frames({
      fps: 120,
      durationMs: 3000,
      cols: 16,
      rows: 12,
      cell: (k) => srgbGray(Math.round(1 + 254 * trianglePhase(4, 120, k))),
    });
    expect(analyze(samples).hazardous).toBe(true);
  });

  it("ignores 2-second sRGB fades black <-> white (S4)", () => {
    const samples = frames({
      fps: 30,
      durationMs: 8000,
      cols: 16,
      rows: 12,
      cell: (k) => srgbGray(Math.round(1 + 254 * trianglePhase(0.25, 30, k))),
    });
    expect(analyze(samples).hazardous).toBe(false);
  });

  it("ignores a single hard cut (S5)", () => {
    const samples = frames({ fps: 30, durationMs: 2000, cols: 16, rows: 12, cell: (k) => (k < 30 ? WHITE : BLACK) });
    const r = analyze(samples);
    expect(r.hazardous).toBe(false);
    expect(r.maxTransitionsInWindow).toBe(1);
  });
});

describe("red flashes", () => {
  it("flags full red <-> black at 5 Hz; it is also a general flash, so reason is 'both' (H6)", () => {
    const r = analyze(fullFrameSquare(5, 30, rgb([0, 0, 0]), rgb([255, 0, 0])));
    expect(r.hazardous).toBe(true);
    expect([...r.reasons]).toEqual(["both"]);
  });

  it("flags a dim red <-> black flash whose luminance delta is below 0.10 as 'red' only", () => {
    const dimRed = rgb([180, 0, 0]);
    expect(dimRed.redSat).toBe(true);
    expect(dimRed.lum).toBeLessThan(0.1);
    const r = analyze(fullFrameSquare(5, 30, rgb([0, 0, 0]), dimRed));
    expect(r.hazardous).toBe(true);
    expect([...r.reasons]).toEqual(["red"]);
  });

  it("ignores a non-red color flash below the luminance threshold (blue <-> black)", () => {
    expect(analyze(fullFrameSquare(5, 30, rgb([0, 0, 0]), rgb([0, 0, 255]))).hazardous).toBe(false);
  });

  it("ignores a flash between two saturated reds below the luminance threshold", () => {
    expect(analyze(fullFrameSquare(5, 30, rgb([200, 0, 0]), rgb([255, 0, 0]))).hazardous).toBe(false);
  });
});

describe("same-direction synchronization (20 ms)", () => {
  // Two 200x120 regions (24,000 px² each, 48,000 together), side by side inside one 416x416 window.
  // Region B lags region A by `lagFrames` at 60 fps.
  function twoRegions(lagFrames: number): FrameSample[] {
    const a = { x0: 0, x1: 200, y0: 0, y1: 120 };
    const b = { x0: 200, x1: 400, y0: 0, y1: 120 };
    const bg = gray(0.2);
    return frames({
      fps: 60,
      durationMs: 3000,
      cols: 64,
      rows: 48,
      cell: (k, x, y) => {
        if (cellInRect(x, y, 64, 48, VIDEO, a)) return squarePhase(5, 60, k) ? BLACK : WHITE;
        if (cellInRect(x, y, 64, 48, VIDEO, b)) return squarePhase(5, 60, Math.max(0, k - lagFrames)) ? BLACK : WHITE;
        return bg;
      },
    });
  }

  it("sums two regions flashing 16.7 ms apart", () => {
    expect(analyze(twoRegions(1)).hazardous).toBe(true);
  });

  it("does not sum two regions flashing 33.3 ms apart", () => {
    expect(analyze(twoRegions(2)).hazardous).toBe(false);
  });
});

describe("reset", () => {
  // 5 Hz at 60 fps: a transition every 100 ms.
  const wave = fullFrameSquare(5, 60, BLACK, WHITE, 1100);

  it("control: 5 Hz over 1.1 s is hazardous with no reset", () => {
    expect(analyze(wave).hazardous).toBe(true);
  });

  it("forgets transitions on reset() (seek)", () => {
    const analyzer = new FlashAnalyzer("low");
    let hazardous = false;
    for (const s of wave) {
      if (s.tMs > 450 && s.tMs < 470) analyzer.reset();
      hazardous ||= analyzer.push(s, VIDEO).hazardous;
    }
    expect(hazardous).toBe(false);
  });

  it("resets itself on a sample gap longer than 100 ms", () => {
    const gapped = wave.filter((s) => s.tMs <= 450 || s.tMs >= 600);
    expect(analyze(gapped).hazardous).toBe(false);
  });

  it("does not reset on a gap of 100 ms or less", () => {
    const gapped = wave.filter((s) => s.tMs <= 450 || s.tMs >= 530); // 450 -> 533.3: an 83 ms gap
    expect(analyze(gapped).hazardous).toBe(true);
  });

  it("resets itself when time goes backwards", () => {
    const back = [...wave.filter((s) => s.tMs <= 450), ...wave.filter((s) => s.tMs > 450).map((s) => ({ ...s, tMs: s.tMs - 450 }))];
    expect(analyze(back).hazardous).toBe(false);
  });

  it("resets itself when the grid size changes", () => {
    const resized = wave.map((s) =>
      s.tMs <= 450 ? s : { ...s, cols: 12, rows: 16 }, // same cell count, different shape
    );
    expect(analyze(resized).hazardous).toBe(false);
  });
});

describe("DetectionResult", () => {
  it("reports 'none' and zero counts on a static frame", () => {
    const analyzer = new FlashAnalyzer("low");
    const [first] = frames({ fps: 30, durationMs: 100, cols: 16, rows: 12, cell: () => WHITE });
    expect(analyzer.push(first!, VIDEO)).toEqual({ hazardous: false, reason: "none", transitionsInWindow: 0, flashingAreaCssPx2: 0 });
  });

  it("reports transitions in window and a flashing area above the threshold for a full-frame flash", () => {
    const r = analyze(fullFrameSquare(5, 30, BLACK, WHITE));
    expect(r.maxTransitionsInWindow).toBeGreaterThanOrEqual(7);
    expect(r.maxFlashingAreaCssPx2).toBeGreaterThanOrEqual(43_264);
  });

  it("setSensitivity switches presets (H9-like region flags only after switching to balanced)", () => {
    const rect = { x0: 0, x1: 200, y0: 0, y1: 150 };
    const samples = frames({
      fps: 30,
      durationMs: 3000,
      cols: 64,
      rows: 48,
      cell: (k, x, y) => (cellInRect(x, y, 64, 48, VIDEO, rect) ? (squarePhase(10, 30, k) ? BLACK : WHITE) : gray(0.2)),
    });
    const analyzer = new FlashAnalyzer("low");
    expect(run(analyzer, samples.slice(0, 45), VIDEO).hazardous).toBe(false);
    analyzer.setSensitivity("balanced");
    expect(run(analyzer, samples.slice(45), VIDEO).hazardous).toBe(true);
  });
});
