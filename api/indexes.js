const { fetchQuotes, INDEX_SYMBOLS } = require("../lib/market");
const { requireUser } = require("../lib/verifyUser");

module.exports = {
  fetch: async function (request) {
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
    try {
      if (!(await requireUser(request))) return json({ error: "Unauthorized" }, 401);
      const data = await fetchQuotes(INDEX_SYMBOLS);
      return json(data);
    } catch (error) {
      return json({ error: error.message || "Unexpected server error." }, 500);
    }
  }
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
