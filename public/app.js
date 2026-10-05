const indexNames = { "^DJI": "Dow", "^IXIC": "Nasdaq", "^GSPC": "S&P 500" };

const state = {
  items: [],
  quotes: new Map(),
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
  signOutBtn: document.querySelector("#signOutBtn"),
  watchRows: document.querySelector("#watchRows")
};

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
    row.addEventListener("click", () => {
      location.href = `/chart.html?symbol=${encodeURIComponent(item.symbol)}`;
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

  await saveWatchlist();

  if (!state.items.length) {
    renderWatchlist();
    els.status.textContent = "Watchlist is empty.";
    return;
  }

  await refreshAll();
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
