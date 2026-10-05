const ranges = ["1d", "5d", "1m", "6m", "ytd", "1y", "3y", "5y"];
const labels = { "1d": "1D", "5d": "5D", "1m": "1M", "6m": "6M", ytd: "YTD", "1y": "1YR", "3y": "3YR", "5y": "5YR" };

const params = new URLSearchParams(location.search);

const state = {
  symbol: cleanSymbol(params.get("symbol") || ""),
  range: ranges.includes(params.get("range")) ? params.get("range") : "1d",
  quote: {},
  chartPoints: [],
  chartLayout: null,
  hoverPoint: null
};

const els = {
  signOutBtn: document.querySelector("#signOutBtn"),
  symbolSwitch: document.querySelector("#symbolSwitch"),
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
  bindEvents();
  buildRangeTabs();
  await loadSymbolSwitch();

  if (!state.symbol) {
    els.chartTitle.textContent = "No ticker selected";
    els.chartMeta.textContent = "Pick a ticker from the dashboard to see its chart.";
    drawChart([]);
    return;
  }

  await refresh();
  window.addEventListener("resize", () => drawChart(state.chartPoints));
}

function bindEvents() {
  els.signOutBtn.addEventListener("click", signOutAndRedirect);
  els.chart.addEventListener("mousemove", handleChartHover);
  els.chart.addEventListener("mouseleave", clearChartHover);
}

async function loadSymbolSwitch() {
  const data = await getJson("/api/watchlist");
  const items = Array.isArray(data.items) ? data.items : [];
  els.symbolSwitch.innerHTML = "";

  if (!items.length) return;

  const select = document.createElement("select");
  select.setAttribute("aria-label", "Switch ticker");
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.symbol;
    option.textContent = item.symbol;
    if (item.symbol === state.symbol) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener("change", () => {
    location.href = `/chart.html?symbol=${encodeURIComponent(select.value)}&range=${state.range}`;
  });
  els.symbolSwitch.appendChild(select);
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
      history.replaceState(null, "", `/chart.html?symbol=${encodeURIComponent(state.symbol)}&range=${range}`);
      buildRangeTabs();
      loadChart();
    });
    els.rangeTabs.appendChild(button);
  }
}

async function refresh() {
  await loadQuote();
  await loadChart();
}

async function loadQuote() {
  const data = await getJson(`/api/quotes?symbols=${encodeURIComponent(state.symbol)}`);
  state.quote = (data.quotes || [])[0] || {};
}

async function loadChart() {
  els.chartTitle.textContent = `${state.symbol} ${labels[state.range]}`;
  els.chartMeta.textContent = state.quote.shortName || state.quote.longName || "Loading chart data...";

  const chartData = await getJson(`/api/chart?symbol=${encodeURIComponent(state.symbol)}&range=${state.range}`);
  els.chartMeta.textContent = state.quote.shortName || state.quote.longName || `${chartData.exchangeName || ""} ${chartData.currency || ""}`.trim();
  state.chartPoints = chartData.points || [];
  state.hoverPoint = null;
  hideTooltip();
  drawChart(state.chartPoints);
  renderStats();
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

function renderStats() {
  const quote = state.quote;
  const stats = [
    ["Open", money(quote.regularMarketOpen)],
    ["Day Range", `${money(quote.regularMarketDayLow)} - ${money(quote.regularMarketDayHigh)}`],
    ["52 Week Range", `${money(quote.fiftyTwoWeekLow)} - ${money(quote.fiftyTwoWeekHigh)}`],
    ["Market Cap", compact(quote.marketCap)],
    ["Avg Volume", compact(quote.averageDailyVolume3Month)],
    ["Day %", Number.isFinite(quote.regularMarketChangePercent) ? `${signed(quote.regularMarketChangePercent)}%` : "—"]
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
