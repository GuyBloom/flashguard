// Area aggregation + synchronization + window counting. SPEC.md §5.4 steps 2-3.

import type { SensitivityConfig } from "./config";
import { HAZARD_WINDOW_MS, SYNC_MS, TIME_EPSILON_MS } from "./config";
import type { CellEmissions } from "./transitions";
import type { Geometry, TransitionDirection } from "./types";

export interface AggregateEvent {
  /** Time of the aggregate's first emitting sample. */
  tMs: number;
  direction: TransitionDirection;
  areaCssPx2: number;
}

/**
 * Maximum flashing area, in CSS px², inside any windowCss-sized window,
 * using a 2D prefix sum over the cell mask. SPEC.md §5.4 step 2.
 *
 * The window is measured in whole cells, rounded up when it covers part of a
 * cell (so it never under-counts), and clamped to the video: when the video
 * is smaller than the window the threshold stays absolute (SPEC.md §5.1).
 */
export function maxWindowArea(
  mask: Uint8Array,
  cols: number,
  rows: number,
  geom: Geometry,
  windowCss: { width: number; height: number },
): number {
  const cellW = geom.widthCss / cols;
  const cellH = geom.heightCss / rows;
  const kw = Math.min(cols, Math.max(1, Math.ceil(windowCss.width / cellW - 1e-9)));
  const kh = Math.min(rows, Math.max(1, Math.ceil(windowCss.height / cellH - 1e-9)));

  const stride = cols + 1;
  const sum = new Int32Array(stride * (rows + 1));
  for (let y = 0; y < rows; y++) {
    let rowSum = 0;
    for (let x = 0; x < cols; x++) {
      rowSum += mask[y * cols + x]!;
      sum[(y + 1) * stride + x + 1] = sum[y * stride + x + 1]! + rowSum;
    }
  }

  let best = 0;
  for (let y = kh; y <= rows; y++) {
    for (let x = kw; x <= cols; x++) {
      const n = sum[y * stride + x]! - sum[(y - kh) * stride + x]! - sum[y * stride + x - kw]! + sum[(y - kh) * stride + x - kw]!;
      if (n > best) best = n;
    }
  }
  return best * cellW * cellH;
}

interface Pending {
  firstT: number;
  mask: Uint8Array;
  qualified: boolean;
}

/**
 * Combines cells emitting in the same direction within SYNC_MS of the
 * aggregate's first emission into one event. An aggregate is reported as soon
 * as its area reaches hazardAreaCssPx2 (once), so synchronization adds no
 * latency. SPEC.md §5.4 step 2.
 */
export class SyncAggregator {
  private pending: Record<TransitionDirection, Pending | null> = { up: null, down: null };

  constructor(private readonly config: SensitivityConfig) {}

  push(
    tMs: number,
    emissions: CellEmissions,
    cols: number,
    rows: number,
    geom: Geometry,
  ): { qualified: AggregateEvent[]; peakAreaCssPx2: number } {
    const qualified: AggregateEvent[] = [];
    let peakAreaCssPx2 = 0;

    for (const direction of ["up", "down"] as const) {
      const cells = emissions[direction];
      if (cells.length === 0) continue;

      let p = this.pending[direction];
      if (!p || p.mask.length !== cols * rows || tMs - p.firstT > SYNC_MS) {
        p = { firstT: tMs, mask: new Uint8Array(cols * rows), qualified: false };
        this.pending[direction] = p;
      }
      for (const c of cells) p.mask[c] = 1;

      const area = maxWindowArea(p.mask, cols, rows, geom, this.config.windowCss);
      peakAreaCssPx2 = Math.max(peakAreaCssPx2, area);
      if (!p.qualified && area >= this.config.hazardAreaCssPx2) {
        p.qualified = true;
        qualified.push({ tMs: p.firstT, direction, areaCssPx2: area });
      }
    }

    return { qualified, peakAreaCssPx2 };
  }

  reset(): void {
    this.pending = { up: null, down: null };
  }
}

/**
 * Qualifying aggregate events within the last HAZARD_WINDOW_MS. Consecutive
 * same-direction events merge, keeping the later time (the conservative
 * choice: the merged transition stays in the window longer). SPEC.md §5.4
 * step 3.
 */
export class WindowCounter {
  private events: AggregateEvent[] = [];

  push(event: AggregateEvent): void {
    const last = this.events[this.events.length - 1];
    if (last && last.direction === event.direction) {
      this.events[this.events.length - 1] = event;
    } else {
      this.events.push(event);
    }
  }

  /** Alternating events with nowMs - tMs < HAZARD_WINDOW_MS. */
  count(nowMs: number): number {
    let drop = 0;
    while (drop < this.events.length && nowMs - this.events[drop]!.tMs >= HAZARD_WINDOW_MS - TIME_EPSILON_MS) drop++;
    if (drop > 0) this.events.splice(0, drop);
    return this.events.length;
  }

  reset(): void {
    this.events = [];
  }
}
