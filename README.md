# DailyStox

A stock and ETF dashboard, deployed to Vercel with Supabase as the database.
See [Deploying](#deploying) below.

Local-run scripts (start/stop/install-node/build-release) live in [sandbox/](sandbox/)
— these are just a throwaway local test env, not how the app is distributed.

## One-click startup

Double-click `sandbox/start.bat`.

The startup script:

1. Moves into this project folder.
2. Starts the local Node server against whatever code is currently on disk (no `git pull` — this is just a local test env for the branch you have checked out).
3. Opens the app in your browser.

## Stop the server

Double-click `sandbox/stop-dailystox.bat`.

This stops the saved DailyStox server process and anything still listening on port `5177`.

## Local Node.js install

If Windows cannot find Node.js 18 or newer, double-click `sandbox/install-node-local.bat`.

This downloads the official Windows x64 Node.js LTS zip into `.runtime/node`. It does not require admin rights and does not install Node globally.

## Build a Shareable Zip

Double-click `sandbox/build-release.bat`.

It creates:

```text
release/DailyStox/
release/DailyStox.zip
```

Send `release/DailyStox.zip` to first-time users. It excludes development files like `.git`, `.runtime`, logs, and your local watchlist data.

## Notes

- Requires Node.js 18 or newer.
- Local-run watchlist data is saved in `data/watchlist.json` (Vercel uses Supabase instead — see below).
- Market data is fetched from Yahoo Finance's public endpoints when the app is running.
- Quotes refresh every 15 seconds. Exchange delays and endpoint availability depend on Yahoo Finance.

## Deploying

The live deployment is Vercel (static files + serverless functions in `api/`)
with Supabase as the database, gated by a single shared password since it's
running on free tiers. Local `server.js` is unrelated to this — it's just the
throwaway sandbox and has no auth.

### 1. Supabase

1. Open your Supabase project's **SQL Editor** and run [supabase/schema.sql](supabase/schema.sql).
2. Go to **Project Settings > API** and copy the **Project URL** and the
   **service_role** secret key (not the `anon` key — the API functions use
   the service role key since they run server-side).

### 2. Vercel

1. Import this repo into Vercel (framework preset: **Other**; no build command needed).
2. In **Project Settings > Environment Variables**, add:
   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL from above |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from above |
   | `SITE_PASSWORD` | the password you'll use to sign in |
   | `AUTH_SECRET` | a random string — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
3. Deploy. Visit the deployment URL — you'll land on `/login.html`; sign in
   with `SITE_PASSWORD`.

See [.env.example](.env.example) for the same variables if you want to test
against Supabase locally instead of running plain `server.js`.

### How the auth works

`middleware.js` runs on every request (pages and `/api/*` alike) and checks
for a signed session cookie. `POST /api/login` checks the password against
`SITE_PASSWORD` and sets that cookie; anything else without it gets redirected
to `/login.html` (or a 401 for API calls). There's one shared password, not
per-user accounts — change `SITE_PASSWORD` in Vercel and redeploy to rotate it.
