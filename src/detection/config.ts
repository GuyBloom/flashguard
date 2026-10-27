// Single source of truth for every detection threshold. SPEC.md §5.5.
//
// Rule (SPEC.md, header): every numeric threshold lives here, with a comment
// naming its source. Never loosen a threshold to make a test pass — explain
// and ask instead (CLAUDE.md "Non-negotiables").

import type { Sensitivity } from "./types";

export interface SensitivityConfig {
  /** Minimum relative-luminance delta to count as a flash. WCAG 2.3.1. */
  minLumDelta: number;
  /** The darker of the two states must be below this to qualify. WCAG 2.3.1. */
  darkerStateMax: number;
  /** Max duration (ms) for a qualifying transition. WCAG 2.3.1 working value. */
  qualifyingMs: number;
  /** More than this many alternating transitions in 1s is a hazard. WCAG 2.3.1. */
  hazardTransitionsPerSec: number;
  /** Minimum flashing area, in CSS px², to qualify. SPEC.md §5.1. */
  hazardAreaCssPx2: number;
  /** The window the area is measured within, in CSS px. SPEC.md §5.1. */
  windowCss: { width: number; height: number };
}

/**
 * SPEC.md §5.5. "low" values come from WCAG 2.3.1 / Jordan & Vanderheiden
 * (2024) Tables 6-7 directly. "balanced" and "high" are starting guesses,
 * **[OPEN]** — tune during testing per SPEC.md §5.5.
 */
export const SENSITIVITY_PRESETS: Record<Sensitivity, SensitivityConfig> = {
  low: {
    minLumDelta: 0.1,
    darkerStateMax: 0.8,
    qualifyingMs: 66,
    hazardTransitionsPerSec: 7,
    hazardAreaCssPx2: 43_264,
    windowCss: { width: 416, height: 416 },
  },
  balanced: {
    minLumDelta: 0.07,
    darkerStateMax: 0.9,
    qualifyingMs: 100,
    hazardTransitionsPerSec: 5,
    hazardAreaCssPx2: 21_824,
    windowCss: { width: 341, height: 256 },
  },
  high: {
    minLumDelta: 0.05,
    darkerStateMax: 1.0, // no darker-state exception
    qualifyingMs: 150,
    hazardTransitionsPerSec: 3,
    hazardAreaCssPx2: 10_000,
    windowCss: { width: 341, height: 256 },
  },
};

export const DEFAULT_SENSITIVITY: Sensitivity = "balanced"; // [OPEN] SPEC.md §7

/** Cells emitting in the same direction within this gap sync into one event. SPEC.md §5.4. */
export const SYNC_MS = 20;

/** Saturated red: R/(R+G+B) >= this, on linearized values. SPEC.md §5.1. */
export const RED_SATURATION_RATIO = 0.8;

/** Minimum CIE 1976 UCS (u', v') distance for a red flash's "other" state. SPEC.md §5.1. */
export const RED_OTHER_STATE_MIN_UV_DISTANCE = 0.2;

/**
 * A non-red state darker than this (relative luminance) counts as "different"
 * from saturated red regardless of its u'v' distance. SPEC.md §5.1 says "a
 * black or very dark state counts as a different state" but gives no number.
 * **[OPEN]** (not in SPEC.md): starting value, team to confirm.
 */
export const RED_DARK_STATE_MAX_LUM = 0.01;

/** A sample gap longer than this resets the analyzer instead of interpolating. SPEC.md §5.2. */
export const MAX_GAP_MS = 100;

/** "More than three flashes in any one-second period". WCAG 2.3.1, SPEC.md §5.1. */
export const HAZARD_WINDOW_MS = 1000;

/**
 * Floating-point tolerance for timestamp comparisons only, so a span that is
 * exactly HAZARD_WINDOW_MS in exact arithmetic (the 3 Hz boundary, SPEC.md
 * §5.1) is not miscounted by rounding. Not a tuning knob.
 */
export const TIME_EPSILON_MS = 1e-6;
