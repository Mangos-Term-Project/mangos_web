# Mangos Python API

## Run locally

1. Create and activate a virtual environment in this directory: `python3 -m venv .venv`, then `source .venv/bin/activate` (on Windows, use `.venv\\Scripts\\activate`).
2. Install dependencies with `pip install -r requirements.txt`.
3. Get required variables into `.env` and set `DATABASE_URL` for your PostgreSQL database.
4. Start the API with `uvicorn app.main:app --reload` (or run `python -m app.main`).

The server reads `HOST` and `PORT` from `.env`. The frontend's Vite proxy should point `API_TARGET` at that same address. Set `RELOAD=false` to disable the development auto-reloader.