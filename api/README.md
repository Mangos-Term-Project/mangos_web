# Mangos Python API

## Run locally

You do not need the Supabase password to work on Mangos. A local database on
your computer has the same tables and every word, and nothing you do there
reaches real users. Needs Docker Desktop (running), Node, and Python 3.10 or newer.

1. From this directory, create and activate a virtual environment: `python3 -m venv .venv`, then `source .venv/bin/activate` (on Windows, use `.venv\Scripts\activate`).
2. Install the project and its dependencies with `pip install -e .`. Rerun this after dependencies change in `pyproject.toml`.
3. In the repository-root `.env` file, point the app at the local services
   (`PIXABAY_API_KEY` is needed for picture search; ask the team for it):
   ```
   DATABASE_URL=postgresql://mangos:mangos_local_only@127.0.0.1:55432/mangos
   REDIS_URL=redis://127.0.0.1:56379/0
   PIXABAY_API_KEY=...
   ```
4. From the repository root, start PostgreSQL and Redis and build the database (tables and words):
   ```
   docker compose -f docker-compose.local.yml up -d
   python api/db/setup_local.py
   ```
   Run `setup_local.py` again after pulling word changes; it only adds what is new.
5. Start the API with `python main.py` (from this directory), and the website with `npm run dev` from the repository root.
   Local accounts are separate from the live site, so create a new one.

`docker compose -f docker-compose.local.yml down -v` deletes the local data.

## Drawable vocabulary
The Draw page reads its prompt, part of speech, definitions, suggested search
phrases, and hand-picked Pixabay image IDs from the PostgreSQL `word` table
(the `senses` JSONB column). Records with a part of speech and non-empty
`senses` are selectable.

**`api/db/words.json` is the master copy of the words.** To change a word,
its suggested searches, or its pictures:

1. Edit `api/db/words.json` in a branch. Check every new picture by eye: tags
   alone miss weapons (a guard's rifle) and misspellings ("riffles").
2. Run `python api/db/setup_local.py` and check the word on the local Draw page.
3. Open a pull request. Bump the `picked:v6` cache version in `main.py` when
   pictures change, so learners do not see the old ones for 24 hours.
4. After the pull request is merged, someone with the Supabase `DATABASE_URL`
   updates the live database from the file:
   ```
   python api/db/sync_words.py                    # shows what will change
   python api/db/sync_words.py --apply --shared   # makes the change
   ```
   Run it as soon as the merge is deployed. A search made in between saves the
   old pictures in the new cache for 24 hours; if that happens, bump the cache
   version again.

Do not edit words directly in Supabase: the next sync would undo the edit, and
edits made outside a pull request are how reviewed pictures got lost before.
`sync_words.py` matches rows by `word_id` and never deletes a word (that would
delete the flash cards made with it).

The table layout is in `api/db/schema.sql`. When you change a table in
Supabase, change that file in the same pull request.

## Reference picture search
The Draw page submits searches to GET /api/images/search?q=clock. It preserves the
existing next-word and save-flashcard workflow; reference images are not saved
as student drawings.

Set PIXABAY_API_KEY in the repository-root .env for local runs and in Vercel's
Production environment for the live app (Preview too when testing preview URLs).
A deployment must be created after saving the value. Never use a VITE_ prefix
for this credential. Existing login and REDIS_URL settings are required.
Successful searches are cached for 24 hours; uncached searches are limited to
10 per account per minute.

Test: sign in, open /draw, search clock, and verify a gallery of reference
pictures. Search also submits with Enter. Then draw and save a flashcard to
verify the current saving workflow.

Provider failures remain failures, rather than falling back to fake images.
Pixabay HTTP status and a bounded response body are returned to the caller and
logged, with the API key redacted and the request URL/query omitted. A
User-Agent identifies Mangos; it does not bypass provider restrictions.

Run provider unit tests: python -m unittest discover -s tests -v
