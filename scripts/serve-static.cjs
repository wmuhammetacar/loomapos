const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const rootArg = process.argv[2];
const portArg = process.argv[3];
const hostArg = process.argv[4];

if (!rootArg) {
  console.error("Usage: node scripts/serve-static.cjs <rootDir> [port] [host]");
  process.exit(1);
}

const rootDir = path.resolve(process.cwd(), rootArg);
const port = Number.parseInt(portArg || "4200", 10);
const host = hostArg || "127.0.0.1";

if (!fs.existsSync(rootDir)) {
  console.error(`Static root does not exist: ${rootDir}`);
  process.exit(1);
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function resolveFilePath(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || "/").split("?")[0]);
  let targetPath = path.join(rootDir, cleanPath);

  if (cleanPath.endsWith("/")) {
    targetPath = path.join(targetPath, "index.html");
  }

  if (!targetPath.startsWith(rootDir)) {
    return null;
  }

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    return targetPath;
  }

  // Flutter web SPA fallback
  const indexPath = path.join(rootDir, "index.html");
  return fs.existsSync(indexPath) ? indexPath : null;
}

const server = http.createServer((req, res) => {
  const filePath = resolveFilePath(req.url);
  if (!filePath) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-cache");

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    res.statusCode = 500;
    res.end("Internal server error");
  });
  stream.pipe(res);
});

server.listen(port, host, () => {
  console.log(`Static server running at http://${host}:${port}`);
  console.log(`Serving: ${rootDir}`);
});
