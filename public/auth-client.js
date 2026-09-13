// Shared Supabase Auth client, loaded by both login.html and index.html
// (after supabase-config.js and the Supabase UMD script). Keeps a
// non-httpOnly "sb-access-token" cookie in sync with the real session so
// middleware.js can cheaply tell whether anyone is signed in at all — the
// actual token validity is checked server-side per request (lib/verifyUser.js).

const authClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const SESSION_COOKIE = "sb-access-token";

function syncSessionCookie(session) {
  if (session && session.access_token) {
    const maxAge = Math.max(0, Math.floor(session.expires_at - Date.now() / 1000));
    document.cookie = `${SESSION_COOKIE}=${session.access_token}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  } else {
    document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0`;
  }
}

authClient.auth.onAuthStateChange((_event, session) => syncSessionCookie(session));
authClient.auth.getSession().then(({ data }) => syncSessionCookie(data.session));

async function getAccessToken() {
  const { data } = await authClient.auth.getSession();
  return data.session && data.session.access_token;
}

async function signOutAndRedirect() {
  await authClient.auth.signOut();
  syncSessionCookie(null);
  location.href = "/login.html";
}
