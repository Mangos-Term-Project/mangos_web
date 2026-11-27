-- Mangos database tables, copied from the live Supabase database (PostgreSQL 17)
-- on 2026-11-27. Used to build a LOCAL database (see api/db/setup_local.py).
--
-- The live tables already exist; never run this file against Supabase.
-- When you change a table in Supabase, change it here too in the same PR.

create extension if not exists "uuid-ossp";

create table if not exists users (
  user_id uuid primary key default uuid_generate_v4(),
  username character varying not null unique,
  password_hash text not null,
  created_at timestamptz default current_timestamp
);

create table if not exists profiles (
  user_id uuid primary key references users(user_id) on delete cascade,
  display_name character varying,
  bio text,
  total_coins integer not null default 0,
  constraint profiles_total_coins_nonnegative check (total_coins >= 0)
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_id_idx on sessions (user_id);

-- Vocabulary. The rows come from api/db/words.json (load with api/db/sync_words.py).
create table if not exists word (
  word_id uuid primary key default uuid_generate_v4(),
  word character varying not null,
  part_of_speech text,
  senses jsonb not null default '[]'::jsonb
);

create table if not exists user_flashcard_sets (
  user_id uuid not null references users(user_id) on delete cascade,
  set_id uuid not null default uuid_generate_v4(),
  name text not null,
  status text not null default 'in_progress',
  is_active boolean default true,
  primary key (user_id, set_id),
  constraint user_flashcard_sets_status_check check (status in ('in_progress', 'in_review'))
);
create unique index if not exists user_flashcard_sets_one_in_progress_per_user
  on user_flashcard_sets (user_id) where (status = 'in_progress');

create table if not exists flashcard (
  flashcard_id uuid primary key default uuid_generate_v4(),
  set_id uuid not null,
  user_id uuid not null,
  word_id uuid references word(word_id) on delete cascade,
  image_url text,
  foreign key (user_id, set_id) references user_flashcard_sets(user_id, set_id) on delete cascade
);

create table if not exists user_flashcard_progress (
  user_id uuid not null references users(user_id) on delete cascade,
  flashcard_id uuid not null references flashcard(flashcard_id) on delete cascade,
  successful_reviews integer default 0,
  last_practiced_at timestamptz,
  next_review_at timestamptz,
  drawing_url text,
  primary key (user_id, flashcard_id)
);

create table if not exists coin_transactions (
  transaction_id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(user_id) on delete cascade,
  amount integer not null,
  reason text,
  created_at timestamptz default current_timestamp
);
create unique index if not exists coin_transactions_quiz_award_unique
  on coin_transactions (user_id, reason) where (reason like 'quiz_correct:%');

create table if not exists user_store_purchases (
  user_id uuid not null references users(user_id),
  item_id integer not null,
  item_name text not null,
  coin_cost integer not null check (coin_cost >= 0),
  purchased_at timestamptz not null default current_timestamp,
  primary key (user_id, item_id)
);

create table if not exists pets (
  pet_id uuid primary key default uuid_generate_v4(),
  name text not null,
  coin_cost integer not null,
  image_url text
);

create table if not exists user_pets (
  user_id uuid not null references users(user_id) on delete cascade,
  pet_id uuid not null references pets(pet_id) on delete cascade,
  acquired_at timestamptz default current_timestamp,
  primary key (user_id, pet_id)
);
