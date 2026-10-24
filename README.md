# Mangos Web

The repository root contains the React/Vite frontend. The FastAPI service is in `api/`.

## Local development

- Frontend: from the repository root, run `npm install` and `npm run dev`.
- API: follow [api/README.md](api/README.md). The local frontend uses `VITE_API_BASE_URL` from the root `.env` for the Vite `/api` proxy.
