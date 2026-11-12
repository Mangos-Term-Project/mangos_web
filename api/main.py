import hashlib
import json
import logging
import os
import re
import secrets
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any
from uuid import UUID

import bcrypt
import certifi
import psycopg2
import psycopg2.errors
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel, Field
from redis import Redis

API_DIR = Path(__file__).resolve().parent
load_dotenv(API_DIR.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "")
REDIS_URL = os.getenv("REDIS_URL", "")
RELOAD = os.getenv("RELOAD", "true").lower() == "true"

SESSION_COOKIE = "mangos_session"
SESSION_SECONDS = 60 * 60
SESSION_KEY_PREFIX = "mangos:session:"
LOCAL_HOSTS = {"localhost", "127.0.0.1"}
USERNAME_PATTERN = re.compile(r"[a-z0-9_]{3,30}")
NAME_MAX_LENGTH = 256
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_BYTES = 72  # bcrypt only accepts up to 72 bytes
LOGIN_FAILED = "Incorrect username or password."

# Checked against when a username doesn't exist, so a login for an unknown
# user does the same bcrypt work as one for a real user.
DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"mangos-dummy-password", bcrypt.gensalt()).decode()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mangos-api")

redis_options: dict[str, Any] = {"decode_responses": True}
redis_options["ssl_ca_certs"] = certifi.where()
session_store = Redis.from_url(REDIS_URL, **redis_options) if REDIS_URL else None

app = FastAPI(title="Mangos API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    name: str
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class FlashCardRequest(BaseModel):
    word_id: UUID
    drawing: str = Field(max_length=2_000_000)


@app.middleware("http")
async def log_requests(request, call_next):
    logger.info("%s %s", request.method, request.url.path)
    return await call_next(request)


@contextmanager
def get_connection(action: str) -> Iterator[Any]:
    """Open a connection for one transaction: commit on success, roll back on error, always close.

    HTTPExceptions raised inside pass through; anything else is logged and becomes a generic 500.
    """
    try:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not configured")
        connection = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        try:
            with connection:
                yield connection
        finally:
            connection.close()
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to %s", action)
        raise HTTPException(status_code=500, detail="Server Error") from None


@contextmanager
def get_session_store(action: str) -> Iterator[Redis]:
    """Use the shared Redis client and convert connection failures to a generic 500."""
    try:
        if session_store is None:
            raise RuntimeError("REDIS_URL is not configured")
        yield session_store
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to %s", action)
        raise HTTPException(status_code=500, detail="Server Error") from None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def session_key(token: str) -> str:
    return f"{SESSION_KEY_PREFIX}{hash_token(token)}"


def create_session(user_id: Any) -> str:
    token = secrets.token_urlsafe(32)
    with get_session_store("create session") as store:
        store.set(session_key(token), str(user_id), ex=SESSION_SECONDS)
    return token


def is_local_request(request: Request) -> bool:
    return request.url.hostname in LOCAL_HOSTS


def set_session_cookie(response: Response, request: Request, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_SECONDS,
        path="/",
        httponly=True,
        samesite="lax",
        secure=not is_local_request(request),
    )


def clear_session_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(
        SESSION_COOKIE,
        path="/",
        httponly=True,
        samesite="lax",
        secure=not is_local_request(request),
    )


def password_matches(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        # Not a bcrypt hash (such as a plain-text legacy row) or a password bcrypt can't take.
        return False


def user_response(row: dict[str, Any]) -> dict[str, str]:
    return {
        "user_id": str(row["user_id"]),
        "username": row["username"],
        "name": row["name"] or row["username"],
    }


def authenticated_user_id(request: Request) -> str:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in.")

    with get_session_store("fetch session") as store:
        user_id = store.get(session_key(token))
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not logged in.")
    return user_id


@app.get("/api/users")
def get_users() -> list[dict[str, Any]]:
    with get_connection("fetch users") as connection, connection.cursor() as cursor:
        cursor.execute("SELECT user_id, username, created_at FROM users")
        rows = cursor.fetchall()
    return [dict(row) for row in rows]


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterRequest, request: Request, response: Response) -> dict[str, str]:
    name = body.name.strip()
    username = body.username.strip().lower()
    password = body.password

    if not name:
        raise HTTPException(status_code=400, detail="Please enter your name.")
    if len(name) > NAME_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="Name must be 256 characters or fewer.")
    if not USERNAME_PATTERN.fullmatch(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3 to 30 characters: letters, numbers or underscores.",
        )
    if len(password) < PASSWORD_MIN_LENGTH:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if len(password.encode()) > PASSWORD_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Password must be at most 72 characters.")

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    with get_connection("register user") as connection, connection.cursor() as cursor:
        try:
            cursor.execute(
                "INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING user_id",
                (username, password_hash),
            )
        except psycopg2.errors.UniqueViolation:
            raise HTTPException(status_code=409, detail="That username is taken.") from None
        user_id = cursor.fetchone()["user_id"]
        cursor.execute(
            "INSERT INTO profiles (user_id, display_name) VALUES (%s, %s)",
            (user_id, name),
        )
        token = create_session(user_id)

    set_session_cookie(response, request, token)
    return user_response({"user_id": user_id, "username": username, "name": name})


@app.post("/api/auth/login")
def login(body: LoginRequest, request: Request, response: Response) -> dict[str, str]:
    username = body.username.strip().lower()

    with get_connection("log in") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT u.user_id, u.username, u.password_hash, p.display_name AS name "
            "FROM users u LEFT JOIN profiles p ON p.user_id = u.user_id "
            "WHERE u.username = %s",
            (username,),
        )
        row = cursor.fetchone()
        matched = password_matches(body.password, row["password_hash"] if row else DUMMY_PASSWORD_HASH)
        if row is None or not matched:
            raise HTTPException(status_code=401, detail=LOGIN_FAILED)
        token = create_session(row["user_id"])

    set_session_cookie(response, request, token)
    return user_response(row)


@app.get("/api/auth/me")
def get_current_user(request: Request) -> dict[str, str]:
    user_id = authenticated_user_id(request)

    with get_connection("fetch current user") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT u.user_id, u.username, p.display_name AS name "
            "FROM users u "
            "LEFT JOIN profiles p ON p.user_id = u.user_id "
            "WHERE u.user_id = %s",
            (user_id,),
        )
        row = cursor.fetchone()

    if row is None:
        raise HTTPException(status_code=401, detail="Not logged in.")
    return user_response(row)


@app.get("/api/words/next")
def get_next_word(
    request: Request,
    exclude_words: list[str] = Query(default=[]),
) -> dict[str, str] | None:
    user_id = authenticated_user_id(request)
    excluded_words = [word.strip().lower() for word in exclude_words if word.strip()]

    with get_connection("fetch next word") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT w.word_id, w.word "
            "FROM word w "
            "WHERE LOWER(w.word) <> ALL(%s) "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM flashcard f "
            "  WHERE f.user_id = %s AND f.word_id = w.word_id"
            ") "
            "ORDER BY RANDOM() "
            "LIMIT 1",
            (excluded_words, user_id),
        )
        row = cursor.fetchone()
    if row is None:
        return None
    return {"word_id": str(row["word_id"]), "word": row["word"]}


@app.get("/api/flashcards")
def get_flashcards(request: Request) -> list[dict[str, str | None]]:
    user_id = authenticated_user_id(request)
    with get_connection("fetch flash cards") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT f.flashcard_id, w.word, p.drawing_url "
            "FROM flashcard f "
            "JOIN word w ON w.word_id = f.word_id "
            "LEFT JOIN user_flashcard_progress p "
            "  ON p.user_id = f.user_id AND p.flashcard_id = f.flashcard_id "
            "WHERE f.user_id = %s "
            "ORDER BY w.word",
            (user_id,),
        )
        rows = cursor.fetchall()
    return [
        {
            "id": str(row["flashcard_id"]),
            "name": row["word"],
            "drawing": row["drawing_url"],
        }
        for row in rows
    ]


@app.post("/api/flashcards", status_code=201)
def create_flashcard(body: FlashCardRequest, request: Request) -> dict[str, str]:
    user_id = authenticated_user_id(request)
    word_id = str(body.word_id)
    if not body.drawing.startswith("data:image/png;base64,"):
        raise HTTPException(status_code=400, detail="The drawing must be a PNG image.")

    with get_connection("create flash card") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT word, word_id FROM word WHERE word_id = %s FOR UPDATE",
            (word_id,),
        )
        word_row = cursor.fetchone()
        if word_row is None:
            raise HTTPException(status_code=404, detail="That word could not be found.")

        cursor.execute(
            "SELECT flashcard_id FROM flashcard WHERE user_id = %s AND word_id = %s LIMIT 1",
            (user_id, word_id),
        )
        if cursor.fetchone() is not None:
            raise HTTPException(status_code=409, detail="You have already saved a flash card for this word.")

        cursor.execute(
            "SELECT set_id FROM user_flashcard_sets "
            "WHERE user_id = %s AND is_active IS TRUE "
            "ORDER BY set_id LIMIT 1",
            (user_id,),
        )
        set_row = cursor.fetchone()
        if set_row is None:
            cursor.execute(
                "INSERT INTO user_flashcard_sets (user_id, name, is_active) "
                "VALUES (%s, %s, TRUE) RETURNING set_id",
                (user_id, "My Flash Cards"),
            )
            set_row = cursor.fetchone()

        cursor.execute(
            "INSERT INTO flashcard (user_id, set_id, word_id) "
            "VALUES (%s, %s, %s) RETURNING flashcard_id",
            (user_id, set_row["set_id"], word_id),
        )
        flashcard_id = cursor.fetchone()["flashcard_id"]
        cursor.execute(
            "INSERT INTO user_flashcard_progress (user_id, flashcard_id, drawing_url) "
            "VALUES (%s, %s, %s)",
            (user_id, flashcard_id, body.drawing),
        )

    return {
        "id": str(flashcard_id),
        "name": word_row["word"],
        "drawing": body.drawing,
    }


@app.post("/api/auth/logout")
def logout(request: Request, response: Response) -> dict[str, bool]:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with get_session_store("log out") as store:
            store.delete(session_key(token))

    clear_session_cookie(response, request)
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5001")),
        reload=RELOAD,
        reload_dirs=[str(API_DIR)],
    )
