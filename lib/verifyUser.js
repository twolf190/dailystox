// Verifies the Supabase session token a browser sends on each API call
// (Authorization: Bearer <access_token>). This is the real auth check —
// middleware.js only does a cheap cookie-presence check to keep anonymous
// traffic off the page; this is what actually confirms the token is a live,
// valid Supabase session.

const { getSupabase } = require("./supabase");

async function requireUser(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const { data, error } = await getSupabase().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

module.exports = { requireUser };
