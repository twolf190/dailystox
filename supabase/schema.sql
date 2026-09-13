-- Run once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Creates the single table the app uses to store the watchlist, replacing
-- the local data/watchlist.json file.

create table watchlist_state (
  id text primary key,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- RLS is on with no policies, so every role except service_role is denied
-- outright. This matters because the app's browser code carries the public
-- anon key (public/supabase-config.js) — without RLS, anyone who copied
-- that key could read/write this table directly via Supabase's REST API,
-- skipping our app, middleware, and login entirely. The app's own API
-- functions still work fine: they use the service_role key from a trusted
-- server, which always bypasses RLS.
alter table watchlist_state enable row level security;

-- Seed the one row the app reads/writes.
insert into watchlist_state (id, items) values ('default', '[]'::jsonb);
