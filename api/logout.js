const { COOKIE_NAME } = require("../lib/auth");

module.exports = {
  fetch: async function (request) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
      }
    });
  }
};
