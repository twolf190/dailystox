// Vercel Routing Middleware — runs before every request (static files and
// API functions alike). See https://vercel.com/docs/routing-middleware
//
// This only checks that a Supabase session cookie is PRESENT, so anonymous
// visitors never even get served the app shell or hit an API route. It is
// not the real auth check — the cookie's token is not signed by us and
// could be forged, but a forged token buys nothing: every API function
// (lib/verifyUser.js) independently verifies the token against Supabase
// Auth before returning any data. That's the actual security boundary.

const { next } = require("@vercel/functions");

const SESSION_COOKIE = "sb-access-token";
const PUBLIC_PATHS = new Set(["/login.html", "/supabase-config.js", "/auth-client.js"]);

module.exports = async function middleware(request) {
  const url = new URL(request.url);
  if (PUBLIC_PATHS.has(url.pathname)) return next();

  if (hasSessionCookie(request.headers.get("cookie"))) return next();

  if (url.pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return Response.redirect(new URL("/login.html", request.url), 302);
};

module.exports.config = { runtime: "nodejs" };

function hasSessionCookie(header) {
  if (!header) return false;
  return new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=[^;]+`).test(header);
}
