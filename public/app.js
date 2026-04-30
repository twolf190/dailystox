const ranges = ["1d", "5d", "1m", "6m", "ytd", "1y", "3y", "5y"];
const labels = { "1d": "1D", "5d": "5D", "1m": "1M", "6m": "6M", ytd: "YTD", "1y": "1YR", "3y": "3YR", "5y": "5YR" };
const indexNames = { "^DJI": "Dow", "^IXIC": "Nasdaq", "^GSPC": "S&P 500" };

const state = {
  items: [],
  quotes: new Map(),
  selected: null,
  range: "1d",
  refreshing: false
};

const els = {
  status: document.querySelector("#status"),
  indexStrip: document.querySelector("#indexStrip"),
  portfolioSummary: document.querySelector("#portfolioSummary"),
  addForm: document.querySelector("#addForm"),
  symbolInput: document.querySelector("#symbolInput"),
  sharesInput: document.querySelector("#sharesInput"),
  costInput: document.querySelector("#costInput"),
  refreshBtn: document.querySelector("#refreshBtn"),
  watchRows: document.querySelector("#watchRows"),
  chartTitle: document.querySelector("#chartTitle"),
  chartMeta: document.querySelector("#chartMeta"),
  rangeTabs: document.querySelector("#rangeTabs"),
  chart: document.querySelector("#chart"),
  statsGrid: document.querySelector("#statsGrid")
};

const ctx = els.chart.getContext("2d");

init();

async function init() {
  buildRangeTabs();
  bindEvents();
  await loadWatchlist();
  await refreshAll();
  setInterval(refreshAll, 15000);
  window.addEventListener("resize", () => {
    if (state.selected) loadChart(state.selected, state.range);
  });
}

function bindEvents() {
  els.addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const symbol = cleanSymbol(els.symbolInput.value);
    if (!symbol) return;

    const existing = state.items.find((item) => item.symbol === symbol);
    const next = {
      symbol,
      shares: numberOrDefault(els.sharesInput.value, 1),
      costBasis: numberOrZero(els.costInput.value),
      notes: ""
    };

    if (existing) Object.assign(existing, next);
    else state.items.push(next);

    state.selected = symbol;
    els.addForm.reset();
    await saveWatchlist();
    await refreshAll();
  });

  els.refreshBtn.addEventListener("click", refreshAll);
}

function buildRangeTabs() {
  els.rangeTabs.innerHTML = "";
  for (const range of ranges) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = labels[range];
    button.className = range === state.range ? "active" : "";
    button.addEventListener("click", () => {
      state.range = range;
      buildRangeTabs();
      if (state.selected) loadChart(state.selected, range);
    });
    els.rangeTabs.appendChild(button);
  }
}

async function loadWatchlist() {
  const data = await getJson("/api/watchlist");
  state.items = Array.isArray(data.items) ? data.items : [];
  state.selected = state.items[0] && state.items[0].symbol;
  renderWatchlist();
}

async function saveWatchlist() {
  await fetch("/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: state.items })
  });
}

async function refreshAll() {
  if (state.refreshing) return;
  state.refreshing = true;
  els.status.textContent = "Refreshing market data...";

  try {
    await Promise.all([refreshIndexes(), refreshQuotes()]);
    renderWatchlist();
    if (state.selected) await loadChart(state.selected, state.range);
    els.status.textContent = `Live refresh every 15 seconds. Last update ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    els.status.textContent = error.message || "Market data is unavailable right now.";
  } finally {
    state.refreshing = false;
  }
}

async function refreshIndexes() {
  const data = await getJson("/api/indexes");
  els.indexStrip.innerHTML = "";
  for (const quote of data.quotes || []) {
    els.indexStrip.appendChild(renderIndexCard(quote));
  }
}

async function refreshQuotes() {
  const symbols = state.items.map((item) => item.symbol);
  if (!symbols.length) {
    state.quotes.clear();
    return;
  }
  const data = await getJson(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
  state.quotes = new Map((data.quotes || []).map((quote) => [quote.symbol, quote]));
}

function renderIndexCard(quote) {
  const card = document.createElement("div");
  card.className = "index-card";
  const change = quote.regularMarketChange || 0;
  const changePct = quote.regularMarketChangePercent || 0;
  card.innerHTML = `
    <strong>${indexNames[quote.symbol] || quote.shortName || quote.symbol}</strong>
    <span>${money(quote.regularMarketPrice, "")}</span>
    <span class="${tone(change)}">${signed(change)} (${signed(changePct)}%)</span>
  `;
  return card;
}

function renderWatchlist() {
  els.watchRows.innerHTML = "";
  let totalValue = 0;
  let totalDayGain = 0;

  if (!state.items.length) {
    els.watchRows.innerHTML = `<tr><td colspan="8">Add a ticker to start tracking.</td></tr>`;
  }

  for (const item of state.items) {
    const quote = state.quotes.get(item.symbol) || {};
    const price = quote.regularMarketPrice || 0;
    const dayGain = (quote.regularMarketChange || 0) * item.shares;
    const value = price * item.shares;
    totalValue += value;
    totalDayGain += dayGain;

    const row = document.createElement("tr");
    row.className = state.selected === item.symbol ? "selected" : "";
    row.innerHTML = `
      <td><strong>${item.symbol}</strong><span class="symbol-name">${quote.shortName || quote.longName || ""}</span></td>
      <td>${money(price)}</td>
      <td class="${tone(quote.regularMarketChange)}">${signed(quote.regularMarketChange)}</td>
      <td class="${tone(quote.regularMarketChangePercent)}">${signed(quote.regularMarketChangePercent)}%</td>
      <td>${compact(item.shares)}</td>
      <td>${money(value)}</td>
      <td>${compact(quote.regularMarketVolume)}</td>
      <td><button class="remove-btn" title="Remove ${item.symbol}" aria-label="Remove ${item.symbol}">&times;</button></td>
    `;
    row.addEventListener("click", () => {
      state.selected = item.symbol;
      renderWatchlist();
      loadChart(item.symbol, state.range);
    });
    row.querySelector("button").addEventListener("click", async (event) => {
      event.stopPropagation();
      state.items = state.items.filter((entry) => entry.symbol !== item.symbol);
      if (state.selected === item.symbol) state.selected = state.items[0] && state.items[0].symbol;
      await saveWatchlist();
      await refreshAll();
    });
    els.watchRows.appendChild(row);
  }

  const previousValue = totalValue - totalDayGain;
  const dayPct = previousValue ? (totalDayGain / previousValue) * 100 : 0;
  els.portfolioSummary.innerHTML = `${money(totalValue)} total value <span class="${tone(totalDayGain)}">${signed(totalDayGain)} (${signed(dayPct)}%) today</span>`;
}

async function loadChart(symbol, range) {
  const [chartData] = await Promise.all([getJson(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`)]);
  const quote = state.quotes.get(symbol) || {};
  els.chartTitle.textContent = `${symbol} ${labels[range]}`;
  els.chartMeta.textContent = quote.shortName || quote.longName || `${chartData.exchangeName || ""} ${chartData.currency || ""}`.trim();
  drawChart(chartData.points || []);
  renderStats(quote);
}

function drawChart(points) {
  const canvas = els.chart;
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(640, Math.floor(rect.width * ratio));
  canvas.height = Math.max(320, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  const pad = { top: 22, right: 56, bottom: 34, left: 16 };
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#171c21";
  ctx.fillRect(0, 0, width, height);

  if (points.length < 2) {
    ctx.fillStyle = "#9aa8b4";
    ctx.fillText("No chart data available.", 20, 34);
    return;
  }

  const closes = points.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const first = closes[0];
  const last = closes[closes.length - 1];
  const stroke = last >= first ? "#33c47f" : "#ff5f6d";

  ctx.strokeStyle = "#303840";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const y = pad.top + (plotH / 4) * i;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
  }
  ctx.stroke();

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = pad.left + (plotW * index) / (points.length - 1);
    const y = pad.top + plotH - ((point.close - min) / span) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
  gradient.addColorStop(0, stroke + "44");
  gradient.addColorStop(1, stroke + "00");
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.fillStyle = "#9aa8b4";
  ctx.font = "12px system-ui";
  ctx.textAlign = "right";
  for (let i = 0; i < 5; i += 1) {
    const value = max - (span / 4) * i;
    const y = pad.top + (plotH / 4) * i + 4;
    ctx.fillText(money(value), width - 8, y);
  }

  ctx.textAlign = "left";
  ctx.fillText(new Date(points[0].time).toLocaleDateString(), pad.left, height - 10);
  ctx.textAlign = "right";
  ctx.fillText(new Date(points[points.length - 1].time).toLocaleDateString(), width - pad.right, height - 10);
}

function renderStats(quote) {
  const selectedItem = state.items.find((item) => item.symbol === state.selected) || {};
  const price = quote.regularMarketPrice || 0;
  const value = price * (selectedItem.shares || 0);
  const cost = (selectedItem.costBasis || 0) * (selectedItem.shares || 0);
  const gain = cost ? value - cost : 0;
  const stats = [
    ["Open", money(quote.regularMarketOpen)],
    ["Day Range", `${money(quote.regularMarketDayLow)} - ${money(quote.regularMarketDayHigh)}`],
    ["52 Week Range", `${money(quote.fiftyTwoWeekLow)} - ${money(quote.fiftyTwoWeekHigh)}`],
    ["Market Cap", compact(quote.marketCap)],
    ["Avg Volume", compact(quote.averageDailyVolume3Month)],
    ["Holdings Gain", cost ? `${signed(gain)} (${signed((gain / cost) * 100)}%)` : "Add avg cost"]
  ];
  els.statsGrid.innerHTML = stats.map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function cleanSymbol(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function numberOrZero(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function numberOrDefault(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function money(value, fallback = "$0.00") {
  if (!Number.isFinite(Number(value))) return fallback;
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function signed(value) {
  if (!Number.isFinite(Number(value))) return "0.00";
  const num = Number(value);
  return `${num > 0 ? "+" : ""}${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function compact(value) {
  if (!Number.isFinite(Number(value))) return "0";
  return Number(value).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 });
}

function tone(value) {
  const num = Number(value);
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "";
}
