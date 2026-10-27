import { describe, expect, it } from "vitest";
import { SENSITIVITY_PRESETS } from "../../src/detection/config";

describe("SENSITIVITY_PRESETS", () => {
  it("has all three presets", () => {
    expect(Object.keys(SENSITIVITY_PRESETS).sort()).toEqual(["balanced", "high", "low"]);
  });

  it("increases sensitivity from low -> balanced -> high (SPEC.md §5.5)", () => {
    const { low, balanced, high } = SENSITIVITY_PRESETS;
    expect(low.minLumDelta).toBeGreaterThan(balanced.minLumDelta);
    expect(balanced.minLumDelta).toBeGreaterThan(high.minLumDelta);

    expect(low.hazardAreaCssPx2).toBeGreaterThan(balanced.hazardAreaCssPx2);
    expect(balanced.hazardAreaCssPx2).toBeGreaterThan(high.hazardAreaCssPx2);

    expect(low.hazardTransitionsPerSec).toBeGreaterThan(balanced.hazardTransitionsPerSec);
    expect(balanced.hazardTransitionsPerSec).toBeGreaterThan(high.hazardTransitionsPerSec);
  });

  it("low matches the WCAG 2.3.1 standard values (SPEC.md §5.1)", () => {
    expect(SENSITIVITY_PRESETS.low.minLumDelta).toBe(0.1);
    expect(SENSITIVITY_PRESETS.low.darkerStateMax).toBe(0.8);
    expect(SENSITIVITY_PRESETS.low.hazardTransitionsPerSec).toBe(7);
  });
});
