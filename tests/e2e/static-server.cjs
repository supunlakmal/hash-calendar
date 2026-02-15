const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function resolveFilePath(requestUrl) {
  const parsed = new URL(requestUrl, `http://127.0.0.1:${PORT}`);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";

  const candidate = path.resolve(ROOT, `.${pathname}`);
  const relative = path.relative(ROOT, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return candidate;
}

async function tryReadFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      return await fs.readFile(path.join(filePath, "index.html"));
    }
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const filePath = resolveFilePath(req.url || "/");
  if (!filePath) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  const data = await tryReadFile(filePath);
  if (!data) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "cache-control": "no-store",
    "content-type": getContentType(filePath),
  });
  res.end(data);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Static server running at http://127.0.0.1:${PORT}`);
});
