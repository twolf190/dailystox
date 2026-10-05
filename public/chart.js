const ranges = ["1d", "5d", "1m", "6m", "ytd", "1y", "3y", "5y"];
const labels = { "1d": "1D", "5d": "5D", "1m": "1M", "6m": "6M", ytd: "YTD", "1y": "1YR", "3y": "3YR", "5y": "5YR" };

const params = new URLSearchParams(location.search);

const state = {
  symbol: cleanSymbol(params.get("symbol") || ""),
  range: ranges.includes(params.get("range")) ? params.get("range") : "1d",
  quote: {}
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

const renderer = createChartRenderer(els.chart, els.chartTooltip, {
  isIntraday: () => state.range === "1d" || state.range === "5d"
});

init();

async function init() {
  bindEvents();
  buildRangeTabs();
  await loadSymbolSwitch();

  if (!state.symbol) {
    els.chartTitle.textContent = "No ticker selected";
    els.chartMeta.textContent = "Pick a ticker from the dashboard to see its chart.";
    renderer.setPoints([]);
    return;
  }

  await refresh();
  window.addEventListener("resize", renderer.redraw);
}

function bindEvents() {
  els.signOutBtn.addEventListener("click", signOutAndRedirect);
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
  renderer.setPoints(chartData.points || []);
  renderStats();
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
