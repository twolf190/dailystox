const http = require("http");
const fs = require("fs");
const path = require("path");

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

const RANGE_INTERVALS = {
  "1d": "1m",
  "5d": "5m",
  "1m": "1d",
  "6m": "1d",
  "ytd": "1d",
  "1y": "1d",
  "3y": "1wk",
  "5y": "1wk"
};

const INDEX_SYMBOLS = ["^DJI", "^IXIC", "^GSPC"];

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

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeRange(range) {
  return RANGE_INTERVALS[range] ? range : "1d";
}

function splitSymbols(symbols) {
  return String(symbols || "")
    .split(",")
    .map(normalizeSymbol)
    .filter(Boolean)
    .slice(0, 80);
}

async function fetchQuotes(symbols) {
  const unique = [...new Set(symbols)];
  if (!unique.length) return { quotes: [] };
  const endpoint = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + encodeURIComponent(unique.join(","));
  try {
    const json = await fetchJson(endpoint);
    return { quotes: (json.quoteResponse && json.quoteResponse.result) || [] };
  } catch {
    const quotes = await Promise.all(unique.map(fetchChartQuote));
    return { quotes: quotes.filter(Boolean) };
  }
}

async function fetchChart(symbol, range) {
  const interval = RANGE_INTERVALS[range];
  const result = await fetchChartResult(symbol, range, interval);
  const points = chartPoints(result);

  return {
    symbol,
    range,
    interval,
    currency: result.meta && result.meta.currency,
    exchangeName: result.meta && result.meta.exchangeName,
    points
  };
}

async function fetchChartQuote(symbol) {
  try {
    const result = await fetchChartResult(symbol, "1d", "1m");
    const meta = result.meta || {};
    const points = chartPoints(result);
    const quote = result.indicators && result.indicators.quote && result.indicators.quote[0] || {};
    const closes = points.map((point) => point.close).filter(Number.isFinite);
    const highs = (quote.high || []).filter(Number.isFinite);
    const lows = (quote.low || []).filter(Number.isFinite);
    const opens = (quote.open || []).filter(Number.isFinite);
    const volumes = (quote.volume || []).filter(Number.isFinite);
    const price = finiteMarketNumber(meta.regularMarketPrice, closes[closes.length - 1]);
    const previousClose = finiteMarketNumber(meta.previousClose, meta.chartPreviousClose);
    const change = Number.isFinite(price) && Number.isFinite(previousClose) ? price - previousClose : 0;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    return {
      symbol,
      shortName: symbol,
      longName: symbol,
      regularMarketPrice: price,
      regularMarketPreviousClose: previousClose,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      regularMarketOpen: finiteMarketNumber(meta.regularMarketOpen, opens[0]),
      regularMarketDayHigh: finiteMarketNumber(meta.regularMarketDayHigh, highs.length ? Math.max(...highs) : price),
      regularMarketDayLow: finiteMarketNumber(meta.regularMarketDayLow, lows.length ? Math.min(...lows) : price),
      regularMarketVolume: finiteMarketNumber(meta.regularMarketVolume, volumes.reduce((sum, value) => sum + value, 0)),
      exchange: meta.exchangeName,
      currency: meta.currency
    };
  } catch {
    return null;
  }
}

async function fetchChartResult(symbol, range, interval) {
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=true&events=div%2Csplits`;
  const json = await fetchJson(endpoint);
  const result = json.chart && json.chart.result && json.chart.result[0];
  if (!result) {
    const description = json.chart && json.chart.error && json.chart.error.description;
    throw new Error(description || `No chart data returned for ${symbol}.`);
  }
  return result;
}

function chartPoints(result) {
  const timestamps = result.timestamp || [];
  const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
  const close = (quote && quote.close) || [];
  const volume = (quote && quote.volume) || [];
  return timestamps
    .map((time, index) => ({
      time: time * 1000,
      close: close[index],
      volume: volume[index]
    }))
    .filter((point) => Number.isFinite(point.close));
}

function finiteMarketNumber(primary, fallback) {
  const primaryNumber = Number(primary);
  if (Number.isFinite(primaryNumber)) return primaryNumber;
  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) ? fallbackNumber : 0;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "DailyStox/0.1"
    }
  });
  if (!response.ok) throw new Error(`Market data request failed (${response.status}).`);
  return response.json();
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
