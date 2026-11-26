# Mangos Python API

## Run locally

1. From this directory, create and activate a virtual environment: `python3 -m venv .venv`, then `source .venv/bin/activate` (on Windows, use `.venv\\Scripts\\activate`).
2. Install the project and its dependencies with `pip install -e .`. Rerun this after dependencies change in `pyproject.toml`.
3. Set `DATABASE_URL` and `REDIS_URL` in the repository-root `.env` file. PostgreSQL stores account/profile data, words, and flash cards; Redis stores login sessions. This single environment file is used by both the frontend and local API.
4. Start the API with `python main.py`.

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
Vercel logs report only status and one of invalid-key, html-block, provider-error,
without logging the key, query, URL, or raw provider response. If Pixabay returns
403, obtain its explanation or contact Pixabay before claiming the integration
works. A User-Agent identifies Mangos; it does not bypass provider restrictions.

Run provider unit tests: python -m unittest discover -s tests -v
