-- Review results and review schedule. Adds new tables only.
--
-- ASSUMES users.user_id and flashcard.flashcard_id are uuid. Check against the
-- schema-only export before running on Supabase, and change the column types
-- below if they differ.

begin;

-- Where each card is in the review schedule (see api/review_schedule.py).
-- A card with no row here has never been reviewed and is due now.
create table if not exists flashcard_review_state (
  flashcard_id uuid primary key references flashcard(flashcard_id) on delete cascade,
  user_id uuid not null references users(user_id) on delete cascade,
  box smallint not null default 0 check (box between 0 and 6),
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  review_count integer not null default 0,
  correct_count integer not null default 0
);

create index if not exists flashcard_review_state_due_idx on flashcard_review_state (user_id, due_at);

-- Every review and quiz answer, including ones made before the card was due.
create table if not exists flashcard_review_log (
  review_id bigint generated always as identity primary key,
  user_id uuid not null references users(user_id) on delete cascade,
  flashcard_id uuid not null references flashcard(flashcard_id) on delete cascade,
  source text not null check (source in ('review', 'quiz')),
  correct boolean not null,
  was_due boolean not null,
  reviewed_at timestamptz not null default now()
);

create index if not exists flashcard_review_log_user_idx on flashcard_review_log (user_id, reviewed_at desc);

alter table flashcard_review_state enable row level security;
alter table flashcard_review_log enable row level security;

commit;
