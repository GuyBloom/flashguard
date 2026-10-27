import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.ts"],
    // src/detection is pure (no DOM, no chrome.*) — node is enough and faster
    // than jsdom. See CLAUDE.md "Non-negotiables".
    environment: "node",
  },
});
