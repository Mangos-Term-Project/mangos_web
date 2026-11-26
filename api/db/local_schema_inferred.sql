-- LOCAL TESTING ONLY. NEVER RUN THIS AGAINST SUPABASE OR ANY SHARED DATABASE.
--
-- The real tables were created by hand in Supabase and are not in this
-- repository. This file rebuilds them from the queries in api/main.py so the
-- app and its tests can run on a local PostgreSQL container.
--
-- Verified from code (the API reads or writes these columns today):
--   users(user_id, username, password_hash, created_at)
--   profiles(user_id, display_name)
--   word(word_id, word)
--   user_flashcard_sets(set_id, user_id, name, is_active)
--   flashcard(flashcard_id, user_id, set_id, word_id)
--   user_flashcard_progress(user_id, flashcard_id, drawing_url)
--
-- INFERRED (not verified; replace with the teammate's schema-only export):
--   * every *_id column is a UUID (the API validates word_id as a UUID, and
--     the deleted api/sql/001_create_sessions.sql referenced users.user_id as uuid)
--   * users.username is unique (the API handles a UniqueViolation on insert)
--   * the real tables may have more columns, defaults, constraints or RLS
--     policies than shown here

create extension if not exists pgcrypto;

create table if not exists users (
  user_id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id uuid primary key references users(user_id) on delete cascade,
  display_name text
);

create table if not exists word (
  word_id uuid primary key default gen_random_uuid(),
  word text not null unique
);

create table if not exists user_flashcard_sets (
  set_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(user_id) on delete cascade,
  name text not null,
  is_active boolean not null default true
);

create table if not exists flashcard (
  flashcard_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(user_id) on delete cascade,
  set_id uuid references user_flashcard_sets(set_id) on delete set null,
  word_id uuid not null references word(word_id)
);

create table if not exists user_flashcard_progress (
  user_id uuid not null references users(user_id) on delete cascade,
  flashcard_id uuid not null references flashcard(flashcard_id) on delete cascade,
  drawing_url text,
  primary key (user_id, flashcard_id)
);
