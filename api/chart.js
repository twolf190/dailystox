const { fetchChart, normalizeSymbol, normalizeRange } = require("../lib/market");
const { requireUser } = require("../lib/verifyUser");

module.exports = {
  fetch: async function (request) {
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
    if (!(await requireUser(request))) return json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const symbol = normalizeSymbol(url.searchParams.get("symbol") || "");
    const range = normalizeRange(url.searchParams.get("range") || "1d");
    if (!symbol) return json({ error: "Missing symbol." }, 400);

    try {
      const data = await fetchChart(symbol, range);
      return json(data);
    } catch (error) {
      return json({ error: error.message || "Unexpected server error." }, 500);
    }
  }
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
