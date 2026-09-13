-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- for the DailyStox project. It creates the single table the app uses to
-- store the watchlist, replacing the local data/watchlist.json file.

create table if not exists watchlist_state (
  id text primary key,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed the one row the app reads/writes (id = 'default').
insert into watchlist_state (id, items)
values ('default', '[]'::jsonb)
on conflict (id) do nothing;

-- Row Level Security stays off: the app talks to Supabase using the
-- service role key from a trusted server (Vercel function), which bypasses
-- RLS anyway, and the app itself is gated by the password in middleware.js.
