# Mangos Web

The repository root contains the React/Vite frontend. The FastAPI service is in `api/`.

## Local development

- Frontend: from the repository root, run `npm install` and `npm run dev`.
- API: follow [api/README.md](api/README.md). The local frontend uses `VITE_API_BASE_URL` from the root `.env` for the Vite `/api` proxy.
- Database: a local PostgreSQL and Redis run in Docker (`docker-compose.local.yml`), with every table and word built by `python api/db/setup_local.py`. No Supabase access is needed.
- Words, definitions, suggested searches and hand-picked pictures: edit `api/db/words.json` (see [api/README.md](api/README.md#drawable-vocabulary)).
