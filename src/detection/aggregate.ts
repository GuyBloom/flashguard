// Area aggregation + synchronization + window counting. SPEC.md §5.4 steps 2-3.
//
// TODO(build order step 2): implement. See color.ts for why this throws
// instead of stubbing a fake result.

import type { SensitivityConfig } from "./config";
import type { Geometry, TransitionDirection } from "./types";

export interface AggregateEvent {
  tMs: number;
  direction: TransitionDirection;
  areaCssPx2: number;
}

/**
 * Combines per-cell transitions emitted in the same direction within
 * SYNC_MS of each other into one event, and computes that event's flashing
 * area as the maximum sum of cell areas inside any windowCss x windowCss
 * window (2D prefix sum). SPEC.md §5.4 step 2.
 */
export function aggregateFrame(
  _upCells: ReadonlySet<number>,
  _downCells: ReadonlySet<number>,
  _cols: number,
  _rows: number,
  _geom: Geometry,
  _config: SensitivityConfig,
  _tMs: number,
): AggregateEvent[] {
  throw new Error("not implemented");
}

/**
 * Tracks qualifying aggregate events (area >= hazardAreaCssPx2) and counts
 * alternating ones within a 1000 ms span. SPEC.md §5.4 step 3.
 */
export class WindowCounter {
  constructor(_config: SensitivityConfig) {
    throw new Error("not implemented");
  }

  push(_event: AggregateEvent): number {
    throw new Error("not implemented");
  }

  reset(): void {
    throw new Error("not implemented");
  }
}
