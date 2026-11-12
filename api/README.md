# Mangos Python API

## Run locally

1. From this directory, create and activate a virtual environment: `python3 -m venv .venv`, then `source .venv/bin/activate` (on Windows, use `.venv\\Scripts\\activate`).
2. Install the project and its dependencies with `pip install -e .`. Rerun this after dependencies change in `pyproject.toml`.
3. Set `DATABASE_URL` and `REDIS_URL` in the repository-root `.env` file. PostgreSQL stores account/profile data; Redis stores login sessions. This single environment file is used by both the frontend and local API.
4. Start the API with `python main.py`.
### Flashcard picture search

1. Sign in to Pixabay and obtain an API key at https://pixabay.com/api/docs/.
2. Add `PIXABAY_API_KEY` to the Vercel project environment (and to the root
   `.env` for local development). Redeploy after changing Vercel settings.
   Keep the key server-side; do not prefix it with `VITE_`.
3. Keep the app's existing Redis connection configured. Searches require a
   logged-in session and results are cached in Redis for 24 hours.
4. Log in, open the drawing page, select a vocabulary prompt, and press Search.
   Searches request SafeSearch illustrations; try a more concrete phrase such
   as “clock” for “time” when results are sparse. Review results before classroom use.

Search results are temporary drawing references. The app does not download
Pixabay images or use them as permanent flashcard assets.
