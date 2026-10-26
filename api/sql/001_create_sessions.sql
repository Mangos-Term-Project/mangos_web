-- Login sessions for the alpha. Same shape as the planned Redis store
-- (token -> user_id with a 1 hour lifetime) so it can be swapped out later.
-- Only the SHA-256 hex digest of each session token is stored.
-- Run this once in the Supabase SQL editor.

create table if not exists public.sessions (
  token_hash text primary key,
  user_id uuid not null references public.users(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);

alter table public.sessions enable row level security;
