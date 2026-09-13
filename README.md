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
2. Go to **Project Settings > API** and copy the **Project URL**, the
   **anon public** key, and the **service_role** secret key.
3. Go to **Authentication > Sign In / Providers** and turn **off** "Allow
   new users to sign up" — this is what keeps the app to just you.
4. Go to **Authentication > Users > Add user** and create yourself an
   account (email + password). This is what you'll sign in with.

### 2. Fill in `public/supabase-config.js`

Edit [public/supabase-config.js](public/supabase-config.js) with the Project
URL and anon key from step 1. These are meant to be public (that's how
Supabase's anon key works) — commit them as-is.

### 3. Vercel

1. Import this repo into Vercel (framework preset: **Other**; no build command needed).
2. In **Project Settings > Environment Variables**, add:
   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 1 |
3. Deploy. Visit the deployment URL — you'll land on `/login.html`; sign in
   with the user you created in step 1.4.

See [.env.example](.env.example) for the same server-side variables if you
want to test against Supabase locally instead of running plain `server.js`.

### How the auth works

Sign-in is handled entirely by Supabase Auth (email/password) from the
browser — there's no `/api/login`. `middleware.js` runs on every request
(pages and `/api/*` alike) and does a cheap check that a session cookie is
merely *present*, so anonymous visitors never get served the app shell at
all. The real check happens per-request in each API function
(`lib/verifyUser.js`), which verifies the token against Supabase Auth before
returning any data — that's the actual security boundary, not the cookie.
Because public sign-ups are off, the only way to get an account is you adding
one in the Supabase dashboard, which is also how you'd add a second person
later.
