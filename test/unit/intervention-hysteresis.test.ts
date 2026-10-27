import { describe, expect, it } from "vitest";
import { InterventionHysteresis } from "../../src/content/intervention";

describe("InterventionHysteresis (SPEC.md §6.1)", () => {
  it("engages immediately on a hazardous result", () => {
    const h = new InterventionHysteresis(2000, 1000);
    expect(h.update(true, 0)).toBe(true);
  });

  it("stays engaged until sustainMs after the last hazardous result", () => {
    const h = new InterventionHysteresis(2000, 1000);
    h.update(true, 0);
    expect(h.update(false, 1999)).toBe(true);
    expect(h.update(false, 2000)).toBe(false);
  });

  it("never toggles twice within minToggleGapMs, even across an engage and a release", () => {
    const h = new InterventionHysteresis(2000, 1000);
    h.update(true, 0); // engages at t=0
    // Would want to release at t=2000, but that's only 2000ms after the
    // engage toggle, which is fine (>= minToggleGapMs=1000); check the
    // reverse: re-engaging too soon after a release is suppressed.
    expect(h.update(false, 2000)).toBe(false); // releases at t=2000
    expect(h.update(true, 2500)).toBe(false); // wants to re-engage at t=2500, but toggled at t=2000 (<1000ms ago)
    expect(h.update(true, 3000)).toBe(true); // 1000ms after the last toggle: allowed
  });

  it("resets to disengaged", () => {
    const h = new InterventionHysteresis(2000, 1000);
    h.update(true, 0);
    h.reset();
    expect(h.update(false, 10)).toBe(false);
  });

  it("resume() restarts the sustain window when engaged, so a sampling gap doesn't release it", () => {
    const h = new InterventionHysteresis(2000, 1000);
    h.update(true, 0); // engaged, then the video scrolls out of view
    h.resume(10_000); // back in view 10s later; analyzer history is empty
    expect(h.update(false, 10_016)).toBe(true);
    expect(h.update(false, 11_999)).toBe(true);
    expect(h.update(false, 12_000)).toBe(false); // no hazard re-detected within sustainMs
  });

  it("resume() does nothing when not engaged", () => {
    const h = new InterventionHysteresis(2000, 1000);
    h.resume(0);
    expect(h.update(false, 16)).toBe(false);
  });
});
