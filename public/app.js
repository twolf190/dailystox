const ranges = ["1d", "5d", "1m", "6m", "ytd", "1y", "3y", "5y"];
const labels = { "1d": "1D", "5d": "5D", "1m": "1M", "6m": "6M", ytd: "YTD", "1y": "1YR", "3y": "3YR", "5y": "5YR" };
const indexNames = { "^DJI": "Dow", "^IXIC": "Nasdaq", "^GSPC": "S&P 500" };

const state = {
  items: [],
  quotes: new Map(),
  selected: null,
  range: "1d",
  refreshing: false,
  chartPoints: [],
  chartLayout: null,
  hoverPoint: null
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
  signOutBtn: document.querySelector("#signOutBtn"),
  watchRows: document.querySelector("#watchRows"),
  chartTitle: document.querySelector("#chartTitle"),
  chartMeta: document.querySelector("#chartMeta"),
  rangeTabs: document.querySelector("#rangeTabs"),
  chart: document.querySelector("#chart"),
  chartTooltip: document.querySelector("#chartTooltip"),
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
  els.signOutBtn.addEventListener("click", signOutAndRedirect);
  els.chart.addEventListener("mousemove", handleChartHover);
  els.chart.addEventListener("mouseleave", clearChartHover);
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
  const response = await fetch("/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ items: state.items })
  });
  if (response.status === 401) return redirectToLogin();
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
    clearChartState();
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
      <td><button class="remove-btn" type="button" title="Delete ${item.symbol}" aria-label="Delete ${item.symbol}">Delete</button></td>
    `;
    row.addEventListener("click", () => {
      state.selected = item.symbol;
      renderWatchlist();
      loadChart(item.symbol, state.range);
    });
    row.querySelector(".remove-btn").addEventListener("click", async (event) => {
      event.stopPropagation();
      await deleteStock(item.symbol);
    });
    els.watchRows.appendChild(row);
  }

  const previousValue = totalValue - totalDayGain;
  const dayPct = previousValue ? (totalDayGain / previousValue) * 100 : 0;
  els.portfolioSummary.innerHTML = `${money(totalValue)} total value <span class="${tone(totalDayGain)}">${signed(totalDayGain)} (${signed(dayPct)}%) today</span>`;
}

async function deleteStock(symbol) {
  if (!window.confirm(`Delete ${symbol} from your watchlist?`)) return;

  state.items = state.items.filter((entry) => entry.symbol !== symbol);
  state.quotes.delete(symbol);

  if (state.selected === symbol) {
    state.selected = state.items[0] && state.items[0].symbol;
  }

  await saveWatchlist();

  if (!state.items.length) {
    renderWatchlist();
    clearChartState();
    els.status.textContent = "Watchlist is empty.";
    return;
  }

  await refreshAll();
}

function clearChartState() {
  state.selected = state.items[0] && state.items[0].symbol;
  state.chartPoints = [];
  state.chartLayout = null;
  state.hoverPoint = null;
  hideTooltip();
  els.chartTitle.textContent = state.selected ? `${state.selected} ${labels[state.range]}` : "Select a ticker";
  els.chartMeta.textContent = state.selected ? "Chart data appears here." : "Add a ticker to show chart data.";
  drawChart([]);
  els.statsGrid.innerHTML = "";
}

async function loadChart(symbol, range) {
  const [chartData] = await Promise.all([getJson(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`)]);
  const quote = state.quotes.get(symbol) || {};
  els.chartTitle.textContent = `${symbol} ${labels[range]}`;
  els.chartMeta.textContent = quote.shortName || quote.longName || `${chartData.exchangeName || ""} ${chartData.currency || ""}`.trim();
  state.chartPoints = chartData.points || [];
  state.hoverPoint = null;
  hideTooltip();
  drawChart(state.chartPoints);
  renderStats(quote);
}

function drawChart(points, hoverIndex = null) {
  const canvas = els.chart;
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(640, Math.floor(rect.width * ratio));
  canvas.height = Math.max(320, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  const pad = { top: 22, right: 56, bottom: 34, left: 16 };
  state.chartLayout = null;
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
  state.chartLayout = { width, height, pad, plotW, plotH, min, max, span };

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

  if (Number.isInteger(hoverIndex) && points[hoverIndex]) {
    drawHoverPoint(points, hoverIndex, stroke);
  }
}

function drawHoverPoint(points, index, stroke) {
  const layout = state.chartLayout;
  if (!layout) return;
  const point = points[index];
  const x = layout.pad.left + (layout.plotW * index) / (points.length - 1);
  const y = layout.pad.top + layout.plotH - ((point.close - layout.min) / layout.span) * layout.plotH;

  ctx.strokeStyle = "#f4f7f9";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, layout.pad.top);
  ctx.lineTo(x, layout.height - layout.pad.bottom);
  ctx.stroke();

  ctx.fillStyle = stroke;
  ctx.strokeStyle = "#f4f7f9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function handleChartHover(event) {
  const points = state.chartPoints;
  const layout = state.chartLayout;
  if (!points.length || !layout) return;

  const rect = els.chart.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const minX = layout.pad.left;
  const maxX = layout.width - layout.pad.right;
  if (x < minX || x > maxX) {
    clearChartHover();
    return;
  }

  const index = Math.max(0, Math.min(points.length - 1, Math.round(((x - minX) / layout.plotW) * (points.length - 1))));
  const point = points[index];
  state.hoverPoint = point;
  drawChart(points, index);
  showTooltip(point, index, rect);
}

function clearChartHover() {
  state.hoverPoint = null;
  hideTooltip();
  drawChart(state.chartPoints);
}

function showTooltip(point, index, rect) {
  const layout = state.chartLayout;
  if (!layout) return;

  const x = layout.pad.left + (layout.plotW * index) / (state.chartPoints.length - 1);
  const y = layout.pad.top + layout.plotH - ((point.close - layout.min) / layout.span) * layout.plotH;
  const date = new Date(point.time);
  const dateLabel = state.range === "1d" || state.range === "5d"
    ? date.toLocaleString()
    : date.toLocaleDateString();

  els.chartTooltip.innerHTML = `
    <strong>${money(point.close)}</strong>
    <span>${dateLabel}</span>
    <span>Volume ${compact(point.volume)}</span>
  `;
  els.chartTooltip.hidden = false;

  const tooltipWidth = els.chartTooltip.offsetWidth;
  const tooltipHeight = els.chartTooltip.offsetHeight;
  const left = Math.max(8, Math.min(rect.width - tooltipWidth - 8, x + 14));
  const top = Math.max(8, Math.min(rect.height - tooltipHeight - 8, y - tooltipHeight - 10));
  els.chartTooltip.style.left = `${left}px`;
  els.chartTooltip.style.top = `${top}px`;
}

function hideTooltip() {
  els.chartTooltip.hidden = true;
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
  const response = await fetch(url, { headers: await authHeaders() });
  if (response.status === 401) return redirectToLogin();
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function authHeaders() {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function redirectToLogin() {
  location.href = `/login.html?next=${encodeURIComponent(location.pathname)}`;
  return new Promise(() => {}); // stop the caller; navigation is already underway
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
