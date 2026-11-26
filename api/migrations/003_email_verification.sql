-- Email ownership verification. Adds new tables only; the users table is not
-- changed, so existing accounts keep working with no email.
--
-- ASSUMES users.user_id is uuid. Check against the schema-only export first.
--
-- TEAM DECISION PENDING: learners include children under 13. Whose email this
-- is (learner, parent/guardian, or teacher) and what consent is needed must be
-- decided by the team before this feature is turned on in production.

begin;

-- The verified email for an account. Not unique: several learners in one
-- family or class may share a parent's or teacher's address.
create table if not exists user_emails (
  user_id uuid primary key references users(user_id) on delete cascade,
  email text not null check (length(email) <= 254),
  verified_at timestamptz not null default now()
);

-- One-time codes. Only a SHA-256 digest of each code is stored.
create table if not exists email_verification_codes (
  code_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(user_id) on delete cascade,
  email text not null check (length(email) <= 254),
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts smallint not null default 0
);

create index if not exists email_verification_codes_user_idx on email_verification_codes (user_id, created_at desc);

alter table user_emails enable row level security;
alter table email_verification_codes enable row level security;

commit;
