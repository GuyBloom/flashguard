// Bundles each entry point with esbuild and copies static assets to dist/.
// Run via `npm run build` (after a type-check — see package.json).

import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const DIST = "dist";

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

await build({
  entryPoints: {
    "content/index": "src/content/index.ts",
    "background/service-worker": "src/background/service-worker.ts",
    "popup/popup": "src/popup/popup.ts",
    "options/options": "src/options/options.ts",
  },
  bundle: true,
  format: "iife",
  target: "chrome110",
  outdir: DIST,
  sourcemap: true,
  logLevel: "info",
});

await cp("manifest.json", `${DIST}/manifest.json`);
await cp("src/popup/popup.html", `${DIST}/popup/popup.html`);
await cp("src/popup/popup.css", `${DIST}/popup/popup.css`);
await cp("src/options/options.html", `${DIST}/options/options.html`);
await cp("src/options/options.css", `${DIST}/options/options.css`);

console.log(`Built extension into ${DIST}/ — load it unpacked via chrome://extensions.`);
