// Signed session cookie helpers for the shared-password gate. The token is
// an HMAC-signed expiry timestamp, so it can be verified statelessly (no
// database lookup) by both the login API route and the root middleware.

const crypto = require("crypto");

const COOKIE_NAME = "ds_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function createToken(secret) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

function verifyToken(token, secret) {
  if (!secret || !token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expectedSig = sign(payload, secret);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookie(header, name) {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

module.exports = { COOKIE_NAME, createToken, verifyToken, parseCookie };
