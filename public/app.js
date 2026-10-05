const indexNames = { "^DJI": "Dow", "^IXIC": "Nasdaq", "^GSPC": "S&P 500" };
const ranges = ["1d", "5d", "1m", "6m", "ytd", "1y", "3y", "5y"];
const labels = { "1d": "1D", "5d": "5D", "1m": "1M", "6m": "6M", ytd: "YTD", "1y": "1YR", "3y": "3YR", "5y": "5YR" };

const state = {
  items: [],
  quotes: new Map(),
  refreshing: false,
  modalSymbol: null,
  modalRange: "1d"
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
  chartModal: document.querySelector("#chartModal"),
  chartModalPanel: document.querySelector("#chartModalPanel"),
  modalChartTitle: document.querySelector("#modalChartTitle"),
  modalChartMeta: document.querySelector("#modalChartMeta"),
  modalRangeTabs: document.querySelector("#modalRangeTabs"),
  modalExpandBtn: document.querySelector("#modalExpandBtn"),
  modalCloseBtn: document.querySelector("#modalCloseBtn"),
  modalChart: document.querySelector("#modalChart"),
  modalChartTooltip: document.querySelector("#modalChartTooltip"),
  modalStatsGrid: document.querySelector("#modalStatsGrid")
};

const modalRenderer = createChartRenderer(els.modalChart, els.modalChartTooltip, {
  isIntraday: () => state.modalRange === "1d" || state.modalRange === "5d"
});

init();

async function init() {
  bindEvents();
  await loadWatchlist();
  await refreshAll();
  setInterval(refreshAll, 15000);
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

    els.addForm.reset();
    await saveWatchlist();
    await refreshAll();
  });

  els.refreshBtn.addEventListener("click", refreshAll);
  els.signOutBtn.addEventListener("click", signOutAndRedirect);

  els.modalCloseBtn.addEventListener("click", closeChartModal);
  els.chartModal.addEventListener("click", (event) => {
    if (event.target === els.chartModal) closeChartModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.chartModal.hidden) closeChartModal();
  });
}

async function loadWatchlist() {
  const data = await getJson("/api/watchlist");
  state.items = Array.isArray(data.items) ? data.items : [];
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
    row.title = `View ${item.symbol} chart`;
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
    row.addEventListener("click", () => openChartModal(item.symbol));
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

  await saveWatchlist();

  if (!state.items.length) {
    renderWatchlist();
    els.status.textContent = "Watchlist is empty.";
    return;
  }

  await refreshAll();
}

function openChartModal(symbol) {
  state.modalSymbol = symbol;
  state.modalRange = "1d";
  els.chartModal.hidden = false;
  buildModalRangeTabs();
  loadModalChart();
}

function closeChartModal() {
  els.chartModal.hidden = true;
}

function buildModalRangeTabs() {
  els.modalRangeTabs.innerHTML = "";
  for (const range of ranges) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = labels[range];
    button.className = range === state.modalRange ? "active" : "";
    button.addEventListener("click", () => {
      state.modalRange = range;
      buildModalRangeTabs();
      loadModalChart();
    });
    els.modalRangeTabs.appendChild(button);
  }
}

async function loadModalChart() {
  const symbol = state.modalSymbol;
  const range = state.modalRange;
  const quote = state.quotes.get(symbol) || {};

  els.modalChartTitle.textContent = `${symbol} ${labels[range]}`;
  els.modalChartMeta.textContent = quote.shortName || quote.longName || "Loading chart data...";
  els.modalExpandBtn.href = `/chart.html?symbol=${encodeURIComponent(symbol)}&range=${range}`;

  const chartData = await getJson(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`);
  if (state.modalSymbol !== symbol || state.modalRange !== range) return; // superseded by a newer selection

  els.modalChartMeta.textContent = quote.shortName || quote.longName || `${chartData.exchangeName || ""} ${chartData.currency || ""}`.trim();
  modalRenderer.setPoints(chartData.points || []);
  renderModalStats(quote);
}

function renderModalStats(quote) {
  const stats = [
    ["Open", money(quote.regularMarketOpen)],
    ["Day Range", `${money(quote.regularMarketDayLow)} - ${money(quote.regularMarketDayHigh)}`],
    ["52 Week Range", `${money(quote.fiftyTwoWeekLow)} - ${money(quote.fiftyTwoWeekHigh)}`],
    ["Avg Volume", compact(quote.averageDailyVolume3Month)]
  ];
  els.modalStatsGrid.innerHTML = stats.map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function numberOrZero(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function numberOrDefault(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}
