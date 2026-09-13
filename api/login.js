const { createToken, COOKIE_NAME } = require("../lib/auth");

module.exports = {
  fetch: async function (request) {
    if (request.method !== "POST") return methodNotAllowed();

    const secret = process.env.AUTH_SECRET;
    const password = process.env.SITE_PASSWORD;
    if (!secret || !password) {
      return json({ error: "Server is not configured. Set AUTH_SECRET and SITE_PASSWORD." }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    if (body.password !== password) {
      return json({ error: "Incorrect password." }, 401);
    }

    const token = createToken(secret);
    const maxAge = 30 * 24 * 60 * 60;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
      }
    });
  }
};

function json(payload, status) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function methodNotAllowed() {
  return new Response("Method Not Allowed", { status: 405 });
}
