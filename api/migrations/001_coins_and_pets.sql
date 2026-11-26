-- Coins and pets. Adds new tables only; existing tables are not changed.
--
-- Before running on Supabase: compare with the schema-only export. This file
-- ASSUMES users.user_id is uuid. If the export shows another type, change the
-- user_id columns below to match.
--
-- Do not run against production until the team has reviewed it. Run it in a
-- branch/preview database first.

begin;

-- One balance per account. The check constraint makes an overdraft impossible
-- even if application code has a bug.
create table if not exists coin_wallets (
  user_id uuid primary key references users(user_id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- Every coin change is recorded. The unique (user_id, source_key) pair is what
-- stops the same reward being paid twice, such as two rewards for one card.
create table if not exists coin_ledger (
  entry_id bigint generated always as identity primary key,
  user_id uuid not null references users(user_id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (reason in ('card_created', 'review_progress', 'pet_purchase')),
  source_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);

create index if not exists coin_ledger_user_created_idx on coin_ledger (user_id, created_at desc);

-- Pet catalog. PLACEHOLDER names and prices (the store's existing prices) for
-- the team to replace.
create table if not exists pets (
  pet_id text primary key check (pet_id ~ '^[a-z0-9_]{1,40}$'),
  name text not null,
  price integer not null check (price > 0),
  sort_order integer not null default 0,
  is_available boolean not null default true
);

insert into pets (pet_id, name, price, sort_order) values
  ('puppy', 'Puppy', 25, 1),
  ('kitten', 'Kitten', 40, 2),
  ('bunny', 'Bunny', 55, 3),
  ('hamster', 'Hamster', 70, 4),
  ('turtle', 'Turtle', 85, 5),
  ('parrot', 'Parrot', 100, 6),
  ('fox', 'Fox', 125, 7),
  ('panda', 'Panda', 150, 8),
  ('unicorn', 'Unicorn', 175, 9)
on conflict (pet_id) do nothing;

-- The primary key makes buying the same pet twice impossible.
create table if not exists user_pets (
  user_id uuid not null references users(user_id) on delete cascade,
  pet_id text not null references pets(pet_id),
  purchased_at timestamptz not null default now(),
  primary key (user_id, pet_id)
);

-- Same approach as the original sessions table: RLS on with no policies, so
-- Supabase's public Data API cannot read these tables. The API's server-side
-- connection is unaffected.
alter table coin_wallets enable row level security;
alter table coin_ledger enable row level security;
alter table pets enable row level security;
alter table user_pets enable row level security;

commit;
