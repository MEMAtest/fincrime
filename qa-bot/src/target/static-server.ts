import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/** Tiny static file server for plain HTML/CSS/JS repos. */
export function startStaticServer(root: string, port: number): Promise<{ port: number; close(): Promise<void> }> {
  const resolvedRoot = path.resolve(root);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const candidates = [urlPath, `${urlPath}.html`, path.posix.join(urlPath, "index.html")];
    for (const c of candidates) {
      const file = path.resolve(resolvedRoot, `.${c}`);
      if (!file.startsWith(resolvedRoot)) break;
      try {
        const st = fs.statSync(file);
        if (!st.isFile()) continue;
        res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
        if (req.method === "HEAD") return res.end();
        fs.createReadStream(file).pipe(res);
        return;
      } catch {
        /* try next candidate */
      }
    }
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><title>404 Not Found</title><h1>404 Not Found</h1>");
  });
  return new Promise((resolve, reject) => {
    const done = () => {
      const addr = server.address();
      resolve({ port: typeof addr === "object" && addr ? addr.port : port, close: () => new Promise<void>((r) => server.close(() => r())) });
    };
    server.once("error", (e: NodeJS.ErrnoException) => {
      // Another process grabbed the port between probing and binding: take any free port instead.
      if (e.code === "EADDRINUSE") server.listen(0, "127.0.0.1", done);
      else reject(e);
    });
    server.listen(port, "127.0.0.1", done);
  });
}
