const { getSupabase } = require("../lib/supabase");
const { requireUser } = require("../lib/verifyUser");

const TABLE = "watchlist_state";
const ROW_ID = "default";

module.exports = {
  fetch: async function (request) {
    try {
      if (!(await requireUser(request))) return json({ error: "Unauthorized" }, 401);
      if (request.method === "GET") return json({ items: await readWatchlist() });
      if (request.method === "POST") return handlePost(request);
      return new Response("Method Not Allowed", { status: 405 });
    } catch (error) {
      return json({ error: error.message || "Unexpected server error." }, 500);
    }
  }
};

async function handlePost(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const items = Array.isArray(body.items) ? body.items.map(cleanItem).filter(Boolean) : [];
  await writeWatchlist(items);
  return json({ items });
}

async function readWatchlist() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(TABLE).select("items").eq("id", ROW_ID).maybeSingle();
  if (error) throw error;
  return Array.isArray(data && data.items) ? data.items : [];
}

async function writeWatchlist(items) {
  const supabase = getSupabase();
  const { error } = await supabase.from(TABLE).upsert({ id: ROW_ID, items, updated_at: new Date().toISOString() });
  if (error) throw error;
}

function cleanItem(item) {
  const symbol = String((item && item.symbol) || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!symbol) return null;
  return {
    symbol,
    shares: finiteNumber(item.shares, 0),
    costBasis: finiteNumber(item.costBasis, 0),
    notes: String(item.notes || "").slice(0, 160)
  };
}

function finiteNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
