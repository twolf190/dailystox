// Lazily-created Supabase client for the Vercel API functions. Uses the
// service role key since this is a single-user server-side app with no
// per-request user identity — the auth gate in middleware.js is what
// actually protects access.

const { createClient } = require("@supabase/supabase-js");

let client;

function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

module.exports = { getSupabase };
