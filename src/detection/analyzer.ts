// FlashAnalyzer: the detection engine's public API. SPEC.md §5.3-§5.4.

import { SyncAggregator, WindowCounter } from "./aggregate";
import type { SensitivityConfig } from "./config";
import { HAZARD_WINDOW_MS, MAX_GAP_MS, SENSITIVITY_PRESETS } from "./config";
import { LuminanceTransitionDetector, RedTransitionDetector } from "./transitions";
import type { DetectionResult, FrameSample, Geometry, HazardReason, Sensitivity } from "./types";

/** Transition detection, aggregation and counting for one signal (luminance or red). */
interface Stream {
  aggregator: SyncAggregator;
  counter: WindowCounter;
}

interface GridState {
  cols: number;
  rows: number;
  lum: LuminanceTransitionDetector;
  red: RedTransitionDetector;
}

export class FlashAnalyzer {
  private config: SensitivityConfig;
  private grid: GridState | null = null;
  private lastT: number | null = null;
  private lumStream!: Stream;
  private redStream!: Stream;
  /** Monotonic max-queue of recent aggregate areas, for flashingAreaCssPx2. */
  private peaks: Array<{ tMs: number; area: number }> = [];

  constructor(sensitivity: Sensitivity) {
    this.config = SENSITIVITY_PRESETS[sensitivity];
    this.reset();
  }

  /** Switches presets. Detector state depends on the preset, so this also resets. */
  setSensitivity(sensitivity: Sensitivity): void {
    this.config = SENSITIVITY_PRESETS[sensitivity];
    this.reset();
  }

  /** Call on seek, src change, or a sample gap > MAX_GAP_MS. SPEC.md §5.2, §5.6. */
  reset(): void {
    this.grid = null;
    this.lastT = null;
    this.lumStream = { aggregator: new SyncAggregator(this.config), counter: new WindowCounter() };
    this.redStream = { aggregator: new SyncAggregator(this.config), counter: new WindowCounter() };
    this.peaks = [];
  }

  /**
   * O(cells) per call. Resets itself first on a gap > MAX_GAP_MS, on time
   * going backwards, or on a grid-size change. SPEC.md §5.2-§5.4.
   */
  push(sample: FrameSample, geom: Geometry): DetectionResult {
    const { tMs, cols, rows } = sample;
    if (
      this.lastT !== null &&
      (tMs <= this.lastT || tMs - this.lastT > MAX_GAP_MS || this.grid?.cols !== cols || this.grid.rows !== rows)
    ) {
      this.reset();
    }
    this.lastT = tMs;
    this.grid ??= {
      cols,
      rows,
      lum: new LuminanceTransitionDetector(this.config, cols * rows),
      red: new RedTransitionDetector(this.config, cols * rows),
    };

    const lumCount = this.step(this.lumStream, tMs, this.grid.lum.push(tMs, sample.lum), cols, rows, geom);
    const redCount = this.step(this.redStream, tMs, this.grid.red.push(tMs, sample), cols, rows, geom);

    while (this.peaks.length > 0 && tMs - this.peaks[0]!.tMs >= HAZARD_WINDOW_MS) this.peaks.shift();

    const lumHazard = lumCount >= this.config.hazardTransitionsPerSec;
    const redHazard = redCount >= this.config.hazardTransitionsPerSec;
    const reason: HazardReason = lumHazard && redHazard ? "both" : lumHazard ? "luminance" : redHazard ? "red" : "none";

    return {
      hazardous: lumHazard || redHazard,
      reason,
      transitionsInWindow: Math.max(lumCount, redCount),
      flashingAreaCssPx2: this.peaks[0]?.area ?? 0,
    };
  }

  /** Aggregates one stream's emissions and returns its count in the window. */
  private step(
    stream: Stream,
    tMs: number,
    emissions: { up: number[]; down: number[] },
    cols: number,
    rows: number,
    geom: Geometry,
  ): number {
    const { qualified, peakAreaCssPx2 } = stream.aggregator.push(tMs, emissions, cols, rows, geom);
    for (const event of qualified) stream.counter.push(event);
    if (peakAreaCssPx2 > 0) {
      while (this.peaks.length > 0 && this.peaks[this.peaks.length - 1]!.area <= peakAreaCssPx2) this.peaks.pop();
      this.peaks.push({ tMs, area: peakAreaCssPx2 });
    }
    return stream.counter.count(tMs);
  }
}
