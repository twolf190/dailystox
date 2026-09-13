// Vercel Routing Middleware — runs before every request (static files and
// API functions alike) and enforces the shared-password gate. See
// https://vercel.com/docs/routing-middleware
//
// Allowed through unauthenticated: the login page itself and the login API.
// Everything else requires a valid signed session cookie, set by
// POST /api/login. Unauthenticated API calls get a 401; unauthenticated page
// loads get redirected to /login.html.

const { next } = require("@vercel/functions");
const { COOKIE_NAME, verifyToken, parseCookie } = require("./lib/auth");

const PUBLIC_PATHS = new Set(["/login.html", "/api/login"]);

module.exports = async function middleware(request) {
  const url = new URL(request.url);

  if (PUBLIC_PATHS.has(url.pathname)) return next();

  const token = parseCookie(request.headers.get("cookie"), COOKIE_NAME);
  const authed = verifyToken(token, process.env.AUTH_SECRET || "");
  if (authed) return next();

  if (url.pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return Response.redirect(new URL("/login.html", request.url), 302);
};

module.exports.config = { runtime: "nodejs" };
