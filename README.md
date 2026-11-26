# Mangos Web

Mangos helps learners practice English by drawing flash cards, reviewing
them, taking quizzes with their own drawings, and earning coins for pets.

- Live app (web and mobile): https://mangoslearningenglish.vercel.app/
- The mobile app is the same app, installable on Android and iPhone: see [docs/MOBILE.md](docs/MOBILE.md).

The repository root contains the React/Vite frontend. The FastAPI service is in `api/`.

## Documentation

- [Feature status: developed, in progress, not yet deployed](docs/FEATURES.md)
- [Mobile app: how it is built, installing, differences, screens](docs/MOBILE.md)
- [Demo checklist for web and mobile](docs/DEMO_CHECKLIST.md)
- [Deployment steps, environment variables, local testing](docs/DEPLOYMENT.md)
- [Picture search: relevance and choices](docs/PICTURE_SEARCH.md)

## Local development

- Frontend: from the repository root, run `npm install` and `npm run dev`.
- API: follow [api/README.md](api/README.md). The local frontend uses `VITE_API_BASE_URL` from the root `.env` for the Vite `/api` proxy.
- To run everything against local test services (database, Redis and a test email inbox), see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#running-everything-locally).
