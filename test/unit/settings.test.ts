import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "../../src/shared/settings";

describe("parseSettings", () => {
  it("falls back to defaults for undefined/corrupt data (SPEC.md §7)", () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("garbage")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it("falls back per-field for an invalid enum value instead of discarding everything", () => {
    const result = parseSettings({ mode: "cover", sensitivity: "standard", allowedHosts: ["example.test"] });
    expect(result.mode).toBe(DEFAULT_SETTINGS.mode);
    expect(result.sensitivity).toBe(DEFAULT_SETTINGS.sensitivity);
    expect(result.allowedHosts).toEqual(["example.test"]);
  });

  it("passes through valid data unchanged", () => {
    const valid = { version: 1, enabled: false, sensitivity: "high", mode: "freeze", allowedHosts: ["a.test"], debugHud: true };
    expect(parseSettings(valid)).toEqual(valid);
  });
});
