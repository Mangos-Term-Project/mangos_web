import logging
import os
from pathlib import Path
from typing import Any

import psycopg2
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "5001"))
DATABASE_URL = os.getenv("DATABASE_URL", "")
RELOAD = os.getenv("RELOAD", "true").lower() == "true"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mangos-api")

app = FastAPI(title="Mangos API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request, call_next):
    logger.info("%s %s", request.method, request.url.path)
    return await call_next(request)


@app.get("/api/users")
def get_users() -> list[dict[str, Any]]:
    if not DATABASE_URL:
        logger.error("DATABASE_URL is not configured")
        raise HTTPException(status_code=500, detail="Database is not configured")

    try:
        with psycopg2.connect(DATABASE_URL) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("SELECT user_id, username, created_at FROM users")
                rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except Exception:
        logger.exception("Failed to fetch users")
        raise HTTPException(status_code=500, detail="Server Error") from None


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=RELOAD,
        reload_dirs=[str(Path(__file__).parent)],
    )
