// Per-cell transition detectors. SPEC.md §5.4 step 1.
//
// One detector covers the whole grid: every cell is sampled on every frame,
// so cells share a ring of sample times and keep their values in flat typed
// arrays (slot-major), instead of one object and deque per cell.

import { uvDistance } from "./color";
import type { SensitivityConfig } from "./config";
import { RED_DARK_STATE_MAX_LUM, RED_OTHER_STATE_MIN_UV_DISTANCE } from "./config";
import type { FrameSample } from "./types";

/** Indices of the cells that emitted a transition on one sample. */
export interface CellEmissions {
  up: number[];
  down: number[];
}

/** Ring size. Covers the largest qualifyingMs (150) at over 400 fps. */
const HISTORY_SLOTS = 64;

const NONE = 0;
const UP = 1;
const DOWN = -1;

/** Shared ring of sample times. */
class SampleHistory {
  private readonly times = new Float64Array(HISTORY_SLOTS);
  private head = 0; // slot the next sample is written to
  private count = 0;

  /** The slot the current sample should be written to. */
  get slot(): number {
    return this.head;
  }

  /** Slot of the sample `back` samples before the current one (1 = previous). */
  slotBack(back: number): number {
    return (this.head - back + HISTORY_SLOTS) % HISTORY_SLOTS;
  }

  /**
   * How many previous samples fall within `qualifyingMs` of `tMs`. Always at
   * least 1 if there is a previous sample: a change between consecutive
   * frames is one displayed step, however far apart the frames are (gaps over
   * MAX_GAP_MS reset the analyzer before reaching here).
   */
  windowLength(tMs: number, qualifyingMs: number): number {
    let n = 0;
    while (n < this.count) {
      const t = this.times[this.slotBack(n + 1)]!;
      if (n > 0 && tMs - t > qualifyingMs) break;
      n++;
    }
    return n;
  }

  advance(tMs: number): void {
    this.times[this.head] = tMs;
    this.head = (this.head + 1) % HISTORY_SLOTS;
    this.count = Math.min(this.count + 1, HISTORY_SLOTS - 1);
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
  }
}

/** General (luminance) flash transitions. SPEC.md §5.1, §5.4 step 1. */
export class LuminanceTransitionDetector {
  private readonly history = new SampleHistory();
  private readonly values: Float32Array;
  private readonly last: Int8Array;

  constructor(
    private readonly config: SensitivityConfig,
    private readonly cells: number,
  ) {
    this.values = new Float32Array(HISTORY_SLOTS * cells);
    this.last = new Int8Array(cells);
  }

  push(tMs: number, lum: Float32Array): CellEmissions {
    const { minLumDelta, darkerStateMax, qualifyingMs } = this.config;
    const n = this.history.windowLength(tMs, qualifyingMs);
    const out: CellEmissions = { up: [], down: [] };
    const base = this.history.slot * this.cells;

    for (let c = 0; c < this.cells; c++) {
      const y = lum[c]!;
      this.values[base + c] = y;
      if (n === 0) continue;

      let min = Infinity;
      let max = -Infinity;
      for (let j = 1; j <= n; j++) {
        const w = this.values[this.history.slotBack(j) * this.cells + c]!;
        if (w < min) min = w;
        if (w > max) max = w;
      }

      const rise = y - min;
      const fall = max - y;
      const canUp = this.last[c] !== UP && rise >= minLumDelta && min < darkerStateMax;
      const canDown = this.last[c] !== DOWN && fall >= minLumDelta && y < darkerStateMax;
      if (canUp && (!canDown || rise >= fall)) {
        this.last[c] = UP;
        out.up.push(c);
      } else if (canDown) {
        this.last[c] = DOWN;
        out.down.push(c);
      }
    }

    this.history.advance(tMs);
    return out;
  }

  reset(): void {
    this.history.reset();
    this.last.fill(NONE);
  }
}

/**
 * Red flash transitions: into a saturated-red state (up) and out of one
 * (down), against a state that is >= RED_OTHER_STATE_MIN_UV_DISTANCE away in
 * u'v' or very dark. SPEC.md §5.1, §5.4 step 1.
 */
export class RedTransitionDetector {
  private readonly history = new SampleHistory();
  private readonly red: Uint8Array;
  private readonly lum: Float32Array;
  private readonly u: Float32Array;
  private readonly v: Float32Array;
  private readonly last: Int8Array;

  constructor(
    private readonly config: SensitivityConfig,
    private readonly cells: number,
  ) {
    this.red = new Uint8Array(HISTORY_SLOTS * cells);
    this.lum = new Float32Array(HISTORY_SLOTS * cells);
    this.u = new Float32Array(HISTORY_SLOTS * cells);
    this.v = new Float32Array(HISTORY_SLOTS * cells);
    this.last = new Int8Array(cells);
  }

  push(tMs: number, sample: Pick<FrameSample, "lum" | "redSat" | "u" | "v">): CellEmissions {
    const n = this.history.windowLength(tMs, this.config.qualifyingMs);
    const out: CellEmissions = { up: [], down: [] };
    const base = this.history.slot * this.cells;

    for (let c = 0; c < this.cells; c++) {
      const isRed = sample.redSat[c]!;
      const lum = sample.lum[c]!;
      const u = sample.u[c]!;
      const v = sample.v[c]!;
      this.red[base + c] = isRed;
      this.lum[base + c] = lum;
      this.u[base + c] = u;
      this.v[base + c] = v;
      if (n === 0) continue;

      const want = isRed ? UP : DOWN;
      if (this.last[c] === want) continue;

      for (let j = 1; j <= n; j++) {
        const i = this.history.slotBack(j) * this.cells + c;
        if (this.red[i] === isRed) continue;
        // One of (current, past) is red; the other must be a different state.
        const otherLum = isRed ? this.lum[i]! : lum;
        if (otherLum < RED_DARK_STATE_MAX_LUM || uvDistance(u, v, this.u[i]!, this.v[i]!) >= RED_OTHER_STATE_MIN_UV_DISTANCE) {
          this.last[c] = want;
          (isRed ? out.up : out.down).push(c);
          break;
        }
      }
    }

    this.history.advance(tMs);
    return out;
  }

  reset(): void {
    this.history.reset();
    this.last.fill(NONE);
  }
}
