# Deploying the checkpoint fixes

The branch `checkpoint-feedback-fixes` adds new database tables. **Run the
migrations before merging.** Once merged, the flash card list reads the new
review table, so merging first would break card loading on the live site.

## Order of steps

1. **Get the real schema.** The teammate who manages PostgreSQL runs a
   schema-only export (no data) and shares the file, never the connection
   string:
   ```
   pg_dump --schema-only --no-owner --no-privileges --schema=public "<connection string>" > mangos_schema.sql
   ```
   (In Supabase, `supabase db dump --schema public` gives the same result.)
2. **Check the migrations against it.** The files in `api/migrations/`
   assume every `*_id` column is a UUID. If the export shows another type
   for `users.user_id` or `flashcard.flashcard_id`, change the matching
   columns in the migrations. The migrations only add tables; they never
   change or drop existing ones.
3. **Run the migrations on a test copy first**, for example a Supabase
   branch or a copy of the project, in order: `001_coins_and_pets.sql`,
   `002_flashcard_reviews.sql`, `003_email_verification.sql`.
4. **Run them on the production database** in the same order (the Supabase
   SQL editor works). Each file is safe to run twice.
5. **Set the environment variables** in Vercel (below), then redeploy.
6. **Merge** `checkpoint-feedback-fixes` into `main`. Vercel deploys it.
7. **Run the [demo checklist](DEMO_CHECKLIST.md)** on the live site, on a
   computer and a phone.

Do not run `api/db/local_schema_inferred.sql` on Supabase. It is a guess at
the existing tables for local testing only.

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | Everything | Already set |
| `REDIS_URL` | Login sessions, search cache | Already set (`rediss://`) |
| `PIXABAY_API_KEY` | Picture search | Already set. Never add a `VITE_` prefix. |
| `EMAIL_VERIFICATION_ENABLED` | Email verification | `true` to turn it on. Off by default. |
| `SMTP_HOST` | Email | From the email service, for example `smtp.resend.com` |
| `SMTP_PORT` | Email | Usually `587` |
| `SMTP_USERNAME` | Email | From the email service |
| `SMTP_PASSWORD` | Email | From the email service; keep it secret |
| `SMTP_FROM` | Email | Sender, for example `Mangos <no-reply@your-domain>` |
| `SMTP_STARTTLS` | Email | `true` (default) for port 587 |

Verification is enforced only when `EMAIL_VERIFICATION_ENABLED=true` **and**
`SMTP_HOST` and `SMTP_FROM` are set. With either missing, the app runs as
before, so no one is locked out by an email service that is not ready.

### Email service

Any provider with SMTP works (Resend, SendGrid, Brevo, Amazon SES and
others). Most require verifying the sending domain. After setting the
variables, create an account with a real address and confirm the code
arrives, including in the spam folder. Do not tell anyone email
verification works until a real email has been received.

### Children under 13

**Team decision needed before turning email verification on.** Learners
include children under 13. The team must decide whose email address is
collected (the learner's, a parent's or guardian's, or a teacher's), what
consent is needed, and what the sign-up form should say. The code does not
assume an answer: the form says only "Email address", and several accounts
may share one address (for example siblings using a parent's email).

## Existing accounts

Existing accounts keep their cards. When verification is on, they are asked
to add and verify an email the next time they log in, and the app is
blocked until they do. Coins start at 0 for everyone; cards made before the
update did not earn coins.

## Running everything locally

Needs Docker Desktop, Node and Python 3.12.

```
docker compose -f docker-compose.local.yml up -d
python api/db/setup_local_db.py
python api/db/setup_local_db.py --database mangos_test
```

Start the API against the local services (these settings override `.env`):

```
DATABASE_URL=postgresql://mangos:mangos_local_only@127.0.0.1:55432/mangos \
REDIS_URL=redis://127.0.0.1:56379/0 \
EMAIL_VERIFICATION_ENABLED=true SMTP_HOST=127.0.0.1 SMTP_PORT=11025 SMTP_STARTTLS=false \
SMTP_FROM="Mangos Local <no-reply@mangos.test>" \
python -m uvicorn main:app --app-dir api --host 127.0.0.1 --port 5101
```

Start the web app pointed at it: `VITE_API_BASE_URL=http://127.0.0.1:5101 npx vite --port 5174`.
Open http://127.0.0.1:5174. Emails (with codes) appear in the local test
inbox at http://127.0.0.1:18025; nothing is sent to real addresses.

### Tests

```
python -m pytest tests                                   # offline tests
MANGOS_TEST_DATABASE_URL=postgresql://mangos:mangos_local_only@127.0.0.1:55432/mangos_test \
  python -m pytest tests                                 # plus database tests
npm run lint && npm run build
```

The database tests cover rewards paid once, purchases with too few coins,
double purchases and simultaneous purchases, account ownership, the review
schedule, sets, and email codes (expiry, single use, attempt and resend
limits, delivery to the local inbox).

## Proposed values for the team to confirm

| Item | Where | Current value |
|---|---|---|
| Review schedule | `api/review_schedule.py` | 1, 2, 4, 7, 14, 30 days; back to the start after "Not yet" |
| Coins per new card | `api/review_schedule.py` | 10 |
| Coins per review level reached | `api/review_schedule.py` | 2 (at most 6 times per card) |
| Pets and prices | `api/migrations/001_coins_and_pets.sql`, `src/data/pets.js` | 9 emoji pets, 25 to 175 coins |
| Cards per set | `api/main.py` (`CARDS_PER_SET`) | 10 |
