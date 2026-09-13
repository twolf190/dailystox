const { fetchQuotes, normalizeSymbol } = require("../lib/market");

module.exports = {
  fetch: async function (request) {
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
    try {
      const url = new URL(request.url);
      const symbols = splitSymbols(url.searchParams.get("symbols"));
      const data = await fetchQuotes(symbols);
      return json(data);
    } catch (error) {
      return json({ error: error.message || "Unexpected server error." }, 500);
    }
  }
};

function splitSymbols(symbols) {
  return String(symbols || "")
    .split(",")
    .map(normalizeSymbol)
    .filter(Boolean)
    .slice(0, 80);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
