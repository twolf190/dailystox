const http = require("http");
const fs = require("fs");
const path = require("path");
const { fetchQuotes, fetchChart, normalizeSymbol, normalizeRange, INDEX_SYMBOLS } = require("./lib/market");

const PORT = Number(process.env.PORT || 5177);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const WATCHLIST_FILE = path.join(DATA_DIR, "watchlist.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

ensureDataFile();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/watchlist") {
      if (req.method === "GET") return sendJson(res, readWatchlist());
      if (req.method === "POST") return saveWatchlist(req, res);
    }

    if (url.pathname === "/api/quotes" && req.method === "GET") {
      const symbols = splitSymbols(url.searchParams.get("symbols"));
      return sendJson(res, await fetchQuotes(symbols));
    }

    if (url.pathname === "/api/indexes" && req.method === "GET") {
      return sendJson(res, await fetchQuotes(INDEX_SYMBOLS));
    }

    if (url.pathname === "/api/chart" && req.method === "GET") {
      const symbol = normalizeSymbol(url.searchParams.get("symbol") || "");
      const range = normalizeRange(url.searchParams.get("range") || "1d");
      if (!symbol) return sendJson(res, { error: "Missing symbol." }, 400);
      return sendJson(res, await fetchChart(symbol, range));
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendJson(res, { error: error.message || "Unexpected server error." }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`DailyStox is running at http://localhost:${PORT}`);
});

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(WATCHLIST_FILE)) {
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify({ items: [] }, null, 2));
  }
}

function readWatchlist() {
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(WATCHLIST_FILE, "utf8"));
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return { items: items.map(cleanWatchItem).filter(Boolean) };
  } catch {
    return { items: [] };
  }
}

async function saveWatchlist(req, res) {
  const body = await readBody(req);
  const parsed = JSON.parse(body || "{}");
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const cleaned = items.map(cleanWatchItem).filter(Boolean);
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify({ items: cleaned }, null, 2));
  sendJson(res, { items: cleaned });
}

function cleanWatchItem(item) {
  const symbol = normalizeSymbol(item && item.symbol);
  if (!symbol) return null;
  return {
    symbol,
    shares: finiteNumber(item.shares, 0),
    costBasis: finiteNumber(item.costBasis, 0),
    notes: String(item.notes || "").slice(0, 160)
  };
}

function finiteNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function splitSymbols(symbols) {
  return String(symbols || "")
    .split(",")
    .map(normalizeSymbol)
    .filter(Boolean)
    .slice(0, 80);
}

function serveStatic(urlPath, res) {
  const safePath = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = safePath.replace(/^[/\\]+/, "");
  const requested = requestedPath ? requestedPath : "index.html";
  const filePath = path.join(PUBLIC_DIR, requested);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, "Forbidden", 403);

  fs.readFile(filePath, (error, content) => {
    if (error) return sendText(res, "Not found", 404);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, text, status = 200) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
