// Shared Yahoo Finance fetch logic, used by both the local dev server
// (server.js) and the Vercel API functions (api/*.js).

const RANGE_CONFIG = {
  "1d": { yahooRange: "1d", interval: "1m" },
  "5d": { yahooRange: "5d", interval: "5m" },
  "1m": { yahooRange: "1mo", interval: "1d" },
  "6m": { yahooRange: "6mo", interval: "1d" },
  "ytd": { yahooRange: "ytd", interval: "1d" },
  "1y": { yahooRange: "1y", interval: "1d" },
  "3y": { yahooRange: "5y", interval: "1wk", years: 3 },
  "5y": { yahooRange: "5y", interval: "1wk" }
};

const INDEX_SYMBOLS = ["^DJI", "^IXIC", "^GSPC"];

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeRange(range) {
  return RANGE_CONFIG[range] ? range : "1d";
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
  const config = RANGE_CONFIG[range];
  const result = await fetchChartResult(symbol, config.yahooRange, config.interval);
  const points = limitChartPoints(chartPoints(result), config);

  return {
    symbol,
    range,
    interval: config.interval,
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
      fiftyTwoWeekHigh: finiteMarketNumber(meta.fiftyTwoWeekHigh, 0),
      fiftyTwoWeekLow: finiteMarketNumber(meta.fiftyTwoWeekLow, 0),
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

function limitChartPoints(points, config) {
  if (!config.years || !points.length) return points;
  const latest = points[points.length - 1].time;
  const cutoff = new Date(latest);
  cutoff.setFullYear(cutoff.getFullYear() - config.years);
  return points.filter((point) => point.time >= cutoff.getTime());
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

module.exports = {
  RANGE_CONFIG,
  INDEX_SYMBOLS,
  normalizeSymbol,
  normalizeRange,
  fetchQuotes,
  fetchChart
};
