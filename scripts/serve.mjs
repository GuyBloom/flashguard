// Zero-dependency static file server for e2e fixtures. SPEC.md §9.3:
// content scripts don't run reliably on file://, so test pages are always
// served over http://localhost.
//
// Usage: node scripts/serve.mjs <root-dir> <port>

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.argv[2] ?? "test/e2e/fixtures";
const port = Number(process.argv[3] ?? 8743);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

const server = createServer((req, res) => {
  void (async () => {
    try {
      const requestUrl = new URL(req.url ?? "/", "http://localhost");
      const decoded = decodeURIComponent(requestUrl.pathname);
      const safe = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
      const filePath = join(root, safe === "/" ? "/index.html" : safe);

      const info = await stat(filePath);
      if (info.isDirectory()) throw new Error("directory listing not supported");

      const body = await readFile(filePath);
      res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  })();
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});
