/**
 * RTX 5090 — zero-dependency static Node.js server.
 * Serves the immersive landing page from this directory.
 *
 * Run:   node server.js
 *        npm start
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif":  "image/gif",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".map":  "application/json; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8",
};

function log(method, status, url, ms) {
  const color = status >= 500 ? "\x1b[31m"
              : status >= 400 ? "\x1b[33m"
              : status >= 300 ? "\x1b[36m"
              : "\x1b[32m";
  console.log(`${color}${status}\x1b[0m  ${method.padEnd(4)} ${url}  \x1b[2m${ms.toFixed(1)}ms\x1b[0m`);
}

function send(res, status, headers, body) {
  res.writeHead(status, {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    ...headers,
  });
  res.end(body);
}

function sendFile(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Fallback to index.html for SPA-ish deep links
      if (path.extname(filePath) === "") {
        return sendFile(req, res, path.join(ROOT, "index.html"));
      }
      return send(res, 404, { "Content-Type": "text/plain" }, "Not found");
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const isHTML = ext === ".html";
    const cacheCtrl = isHTML
      ? "no-cache"
      : (process.env.NODE_ENV === "production" ? "public, max-age=3600" : "no-cache");

    // ETag for conditional GETs
    const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(36)}"`;
    if (req.headers["if-none-match"] === etag) {
      return send(res, 304, { ETag: etag, "Cache-Control": cacheCtrl }, "");
    }

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": cacheCtrl,
      "ETag": etag,
      "Last-Modified": stat.mtime.toUTCString(),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function safeResolve(urlPath) {
  // decode + strip query, then resolve against ROOT and reject traversal
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const resolved = path.normalize(path.join(ROOT, decoded));
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  const t0 = process.hrtime.bigint();
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Only allow GET/HEAD
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, { "Allow": "GET, HEAD" }, "Method not allowed");
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return log(req.method, 405, url.pathname, ms);
  }

  // Health check
  if (url.pathname === "/healthz") {
    const body = JSON.stringify({
      ok: true,
      service: "rtx-5090-landing",
      uptime: process.uptime(),
      node: process.version,
    });
    send(res, 200, { "Content-Type": "application/json; charset=utf-8" }, body);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return log(req.method, 200, url.pathname, ms);
  }

  // Resolve to a file path, defaulting to index.html
  let urlPath = url.pathname;
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  const resolved = safeResolve(urlPath);
  if (!resolved) {
    send(res, 403, { "Content-Type": "text/plain" }, "Forbidden");
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return log(req.method, 403, url.pathname, ms);
  }

  // Intercept response.end to log status
  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = (code, ...rest) => {
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      log(req.method, code, url.pathname, ms);
    });
    return origWriteHead(code, ...rest);
  };

  sendFile(req, res, resolved);
});

server.listen(PORT, HOST, () => {
  console.log(`\n\x1b[32m▸\x1b[0m RTX 5090 landing → \x1b[1mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  health:  http://localhost:${PORT}/healthz`);
  console.log(`  root:    ${ROOT}\n`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`\n▸ ${sig} — shutting down`);
    server.close(() => process.exit(0));
  });
}
