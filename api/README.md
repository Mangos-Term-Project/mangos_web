# Mangos Python API

## Run locally

1. From this directory, create and activate a virtual environment: `python3 -m venv .venv`, then `source .venv/bin/activate` (on Windows, use `.venv\\Scripts\\activate`).
2. Install the project and its dependencies with `pip install -e .`.
3. Set `DATABASE_URL` in the repository-root `.env` file. This single environment file is used by both the frontend and local API.
4. Start the API with `python main.py`.