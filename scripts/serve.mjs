// Zero-dependency static file server for e2e fixtures. SPEC.md §9.3:
// content scripts don't run reliably on file://, so test pages are always
// served over http://localhost.
//
// Usage: node scripts/serve.mjs <root-dir> <port>

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.argv[2] ?? "test/e2e/fixtures";
const port = Number(process.argv[3] ?? 8743);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".mp4": "video/mp4",
};

const server = createServer((req, res) => {
  void (async () => {
    try {
      const requestUrl = new URL(req.url ?? "/", "http://localhost");
      const decoded = decodeURIComponent(requestUrl.pathname);
      const safe = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
      const filePath = join(root, safe === "/" ? "/index.html" : safe);
      const contentType = CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";

      const info = await stat(filePath);
      if (info.isDirectory()) throw new Error("directory listing not supported");

      // <video> elements issue Range requests for seeking/buffering; serve
      // them properly instead of always sending the whole file.
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        const start = match?.[1] ? Number(match[1]) : 0;
        const end = match?.[2] ? Number(match[2]) : info.size - 1;
        res.writeHead(206, {
          "Content-Type": contentType,
          "Content-Length": end - start + 1,
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Accept-Ranges": "bytes",
        });
        createReadStream(filePath, { start, end }).pipe(res);
        return;
      }

      const body = await readFile(filePath);
      res.writeHead(200, { "Content-Type": contentType, "Accept-Ranges": "bytes", "Content-Length": body.length });
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
