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

try:
    from .content_filter import is_blocked
    from .image_search import ImageSearchError, fetch_image_by_id, fetch_images
except ImportError:
    from content_filter import is_blocked
    from image_search import ImageSearchError, fetch_image_by_id, fetch_images

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
QUIZ_COIN_REWARD = 1
STORE_CATALOG = {
    1: ("Item 1", 25),
    2: ("Item 2", 40),
    3: ("Item 3", 55),
    4: ("Item 4", 70),
    5: ("Item 5", 85),
    6: ("Item 6", 100),
    7: ("Item 7", 125),
    8: ("Item 8", 150),
    9: ("Item 9", 175),
}

# Checked against when a username doesn't exist, so a login for an unknown
# user does the same bcrypt work as one for a real user.
DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"mangos-dummy-password", bcrypt.gensalt()).decode()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mangos-api")

redis_options: dict[str, Any] = {"decode_responses": True}
if REDIS_URL.startswith("rediss://"):  # TLS (Upstash); the local Redis is plain redis:// and rejects this option
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
    set_id: UUID | None = None


class QuizAnswerRequest(BaseModel):
    set_id: UUID
    flashcard_id: UUID
    selected_flashcard_id: UUID


class StorePurchaseRequest(BaseModel):
    item_id: int


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


def get_drawable_word_rows(word: str, part_of_speech: str | None = None) -> list[dict[str, Any]]:
    query = (
        "SELECT word_id, word, part_of_speech, senses "
        "FROM public.word WHERE part_of_speech IS NOT NULL "
        "AND senses <> '[]'::jsonb AND LOWER(word) = %s"
    )
    params: tuple[str, ...] = (word,)
    if part_of_speech:
        query += " AND part_of_speech = %s"
        params += (part_of_speech,)
    query += " ORDER BY CASE part_of_speech WHEN 'noun' THEN 0 WHEN 'verb' THEN 1 ELSE 2 END"
    with get_connection("fetch drawable word") as connection, connection.cursor() as cursor:
        cursor.execute(query, params)
        return cursor.fetchall()


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


def user_response(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_id": str(row["user_id"]),
        "username": row["username"],
        "name": row["name"] or row["username"],
        "coins": int(row.get("total_coins") or 0),
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


def get_or_create_in_progress_set(cursor: Any, user_id: str) -> dict[str, Any]:
    cursor.execute(
        "SELECT set_id, name, status FROM user_flashcard_sets "
        "WHERE user_id = %s AND status = 'in_progress' "
        "ORDER BY set_id LIMIT 1",
        (user_id,),
    )
    set_row = cursor.fetchone()
    if set_row is None:
        cursor.execute(
            "SELECT COUNT(*) AS completed_count FROM user_flashcard_sets "
            "WHERE user_id = %s AND status = 'in_review'",
            (user_id,),
        )
        completed_count = cursor.fetchone()["completed_count"]
        cursor.execute(
            "INSERT INTO user_flashcard_sets (user_id, name, is_active, status) "
            "VALUES (%s, %s, TRUE, 'in_progress') "
            "RETURNING set_id, name, status",
            (user_id, f"Set {completed_count + 1}"),
        )
        set_row = cursor.fetchone()
    return set_row


@app.get("/api/users")
def get_users() -> list[dict[str, Any]]:
    with get_connection("fetch users") as connection, connection.cursor() as cursor:
        cursor.execute("SELECT user_id, username, created_at FROM users")
        rows = cursor.fetchall()
    return [dict(row) for row in rows]


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterRequest, request: Request, response: Response) -> dict[str, Any]:
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
            "INSERT INTO profiles (user_id, display_name, total_coins) VALUES (%s, %s, 0)",
            (user_id, name),
        )
        token = create_session(user_id)

    set_session_cookie(response, request, token)
    return user_response({"user_id": user_id, "username": username, "name": name, "total_coins": 0})


@app.post("/api/auth/login")
def login(body: LoginRequest, request: Request, response: Response) -> dict[str, Any]:
    username = body.username.strip().lower()

    with get_connection("log in") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT u.user_id, u.username, u.password_hash, p.display_name AS name, p.total_coins "
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
def get_current_user(request: Request) -> dict[str, Any]:
    user_id = authenticated_user_id(request)

    with get_connection("fetch current user") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT u.user_id, u.username, p.display_name AS name, p.total_coins "
            "FROM users u "
            "LEFT JOIN profiles p ON p.user_id = u.user_id "
            "WHERE u.user_id = %s",
            (user_id,),
        )
        row = cursor.fetchone()

    if row is None:
        raise HTTPException(status_code=401, detail="Not logged in.")
    return user_response(row)


# Open Pixabay results for these topics show weapons, explosions, or unrelated
# things (a "soldier" beetle, Siamese "fighting" fish). They show the checked
# pictures of a vocabulary word instead.
WAR_WORDS = {"war", "wars"}
SOLDIER_WORDS = {"soldier", "soldiers", "army", "armies", "military", "troops", "fight", "fighting", "battle", "battles"}


def safe_topic(query: str) -> str:
    """"war" (a vocabulary word with checked pictures) for war searches, else the query unchanged.

    Any search that mentions war ("fighting for war"), or is just one war word
    ("soldiers"), is redirected; "fighting fish" and "soldier beetle" search normally.
    """
    tokens = query.split()
    if WAR_WORDS & set(tokens) or (len(tokens) == 1 and tokens[0] in SOLDIER_WORDS):
        return "war"
    return query


@app.get("/api/images/search")
def search_images(
    request: Request,
    q: str = Query(min_length=1, max_length=80),
    image_type: str = Query(default="all", pattern="^(all|photo|illustration|vector)$"),
):
    user_id = authenticated_user_id(request)
    query = " ".join(q.split()).casefold()
    if not query:
        raise HTTPException(status_code=400, detail="Enter a word to search.")
    key = os.getenv("PIXABAY_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="Picture search is not configured yet.")
    # Searches containing rude, adult or frightening words are refused (content_filter.py).
    if is_blocked(query):
        raise HTTPException(status_code=400, detail="Please try a different word.")
    query = safe_topic(query)
    # Vocabulary definitions, phrases, and curated Pixabay IDs live in PostgreSQL.
    word_rows = get_drawable_word_rows(query)
    if word_rows:
        word_row = word_rows[0]
        senses = word_row["senses"] or []
        if any(sense.get("pixabay_image_ids") for sense in senses):
            return picked_pictures(query, key, word_row=word_row)
        if senses:
            query = senses[0]["search_phrase"]
            if image_type == "all" and word_row["part_of_speech"] != "noun":
                image_type = "illustration"
    # v5: a longer blocked-word list (content_filter.py).
    cache_key = f"mangos:images:v5:{image_type}:{hash_token(query)}"
    with get_session_store("search reference pictures") as store:
        cached = store.get(cache_key)
        if cached:
            return json.loads(cached)
        with store.pipeline() as pipe:
            count, _ = pipe.incr(f"mangos:images:rate:{user_id}").expire(
                f"mangos:images:rate:{user_id}", 60, nx=True).execute()
        if count > 10:
            raise HTTPException(status_code=429, detail="Please wait a minute before searching again.")
        try:
            result = fetch_images(query, key, image_type)
        except ImageSearchError as error:
            raise HTTPException(status_code=error.status, detail=error.message) from None
        store.set(cache_key, json.dumps(result), ex=86400)
        return result


def picked_pictures(
    word: str,
    key: str,
    part_of_speech: str | None = None,
    word_row: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Fetch curated pictures stored on a drawable word row."""
    # Bump the version when words.json pictures change, so learners do not see old picks for 24 hours.
    cache_key = f"mangos:images:picked:v5:{word}:{part_of_speech or (word_row or {}).get('part_of_speech', 'any')}"
    with get_session_store("load picked pictures") as store:
        cached = store.get(cache_key)
        if cached:
            return json.loads(cached)
        if word_row is None:
            rows = get_drawable_word_rows(word, part_of_speech)
            if not rows:
                return {"images": [], "groups": [], "picked": False}
            word_row = rows[0]
        groups = []
        for sense_index, sense_data in enumerate(word_row["senses"] or []):
            images = []
            for image_id in sense_data.get("pixabay_image_ids", []):
                try:
                    image = fetch_image_by_id(image_id, key)
                except ImageSearchError as error:
                    raise HTTPException(status_code=error.status, detail=error.message) from None
                if image:
                    images.append(image)
            if images:
                groups.append({"part": word_row["part_of_speech"], "sense": sense_index, "images": images})
        # "images" lists every picture; "groups" splits them by part of speech.
        result = {"images": [image for group in groups for image in group["images"]], "groups": groups, "picked": True}
        store.set(cache_key, json.dumps(result), ex=86400)
        return result


@app.get("/api/images/word")
def word_pictures(
    request: Request,
    word: str = Query(min_length=1, max_length=40),
    part_of_speech: str | None = Query(default=None, pattern="^(noun|verb|adjective)$"),
):
    """Hand-picked pictures for a vocabulary word; empty when none are picked yet."""
    authenticated_user_id(request)
    normalized = word.strip().casefold()
    key = os.getenv("PIXABAY_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="Picture search is not configured yet.")
    return picked_pictures(normalized, key, part_of_speech)


@app.get("/api/words/next")
def get_next_word(
    request: Request,
    exclude_words: list[str] = Query(default=[]),
) -> dict[str, Any] | None:
    user_id = authenticated_user_id(request)
    excluded_words = [word.strip().lower() for word in exclude_words if word.strip()]

    with get_connection("fetch next word") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT w.word_id, w.word, w.part_of_speech, w.senses "
            "FROM word w "
            "WHERE w.part_of_speech IS NOT NULL "
            "AND w.senses <> '[]'::jsonb "
            "AND LOWER(w.word) <> ALL(%s) "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM flashcard f "
            "  JOIN word saved_word ON saved_word.word_id = f.word_id "
            "  WHERE f.user_id = %s AND LOWER(saved_word.word) = LOWER(w.word)"
            ") "
            "ORDER BY RANDOM() "
            "LIMIT 1",
            (excluded_words, user_id),
        )
        row = cursor.fetchone()
    if row is None:
        return None

    with get_connection("fetch active flash card set") as connection, connection.cursor() as cursor:
        cursor.execute("SELECT user_id FROM users WHERE user_id = %s FOR UPDATE", (user_id,))
        set_row = get_or_create_in_progress_set(cursor, user_id)
        cursor.execute(
            "SELECT COUNT(*) AS card_count FROM flashcard WHERE user_id = %s AND set_id = %s",
            (user_id, set_row["set_id"]),
        )
        card_count = cursor.fetchone()["card_count"]

    senses = row["senses"] or []
    return {
        "word_id": str(row["word_id"]),
        "word": row["word"],
        "part_of_speech": row["part_of_speech"],
        "set_id": str(set_row["set_id"]),
        "set_name": set_row["name"],
        "set_card_number": card_count + 1,
        "set_card_limit": 50,
        "hints": [{
            "partOfSpeech": row["part_of_speech"],
            "senses": [{
                "definition": sense["definition"],
                "searchPhrase": sense["search_phrase"],
                "moreSearches": sense.get("more_searches", []),
            } for sense in senses],
        }],
    }


@app.get("/api/flashcard-sets")
def get_flashcard_sets(request: Request) -> list[dict[str, Any]]:
    user_id = authenticated_user_id(request)
    with get_connection("fetch flash card sets") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT s.set_id, s.name AS set_name, s.status, f.flashcard_id, w.word, p.drawing_url "
            "FROM user_flashcard_sets s "
            "LEFT JOIN flashcard f ON f.set_id = s.set_id AND f.user_id = s.user_id "
            "LEFT JOIN word w ON w.word_id = f.word_id "
            "LEFT JOIN user_flashcard_progress p "
            "  ON p.user_id = f.user_id AND p.flashcard_id = f.flashcard_id "
            "WHERE s.user_id = %s "
            "ORDER BY s.set_id, w.word",
            (user_id,),
        )
        rows = cursor.fetchall()

    sets_by_id: dict[str, dict[str, Any]] = {}
    for row in rows:
        set_id = str(row["set_id"])
        flashcard_set = sets_by_id.setdefault(set_id, {
            "id": set_id,
            "name": row["set_name"],
            "status": row["status"],
            "flashCards": [],
        })
        if row["flashcard_id"] is not None:
            flashcard_set["flashCards"].append({
                "id": str(row["flashcard_id"]),
                "name": row["word"],
                "drawing": row["drawing_url"],
            })
    return list(sets_by_id.values())


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
def create_flashcard(body: FlashCardRequest, request: Request) -> dict[str, Any]:
    user_id = authenticated_user_id(request)
    word_id = str(body.word_id)
    if not body.drawing.startswith("data:image/png;base64,"):
        raise HTTPException(status_code=400, detail="The drawing must be a PNG image.")

    with get_connection("create flash card") as connection, connection.cursor() as cursor:
        cursor.execute("SELECT user_id FROM users WHERE user_id = %s FOR UPDATE", (user_id,))
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

        set_row = get_or_create_in_progress_set(cursor, user_id)
        if body.set_id is not None and str(body.set_id) != str(set_row["set_id"]):
            raise HTTPException(status_code=409, detail="Your active set changed. Please try this word again.")

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
        cursor.execute(
            "SELECT COUNT(*) AS card_count FROM flashcard WHERE set_id = %s AND user_id = %s",
            (set_row["set_id"], user_id),
        )
        card_count = cursor.fetchone()["card_count"]
        if card_count >= 50 and set_row["status"] == "in_progress":
            cursor.execute(
                "UPDATE user_flashcard_sets SET status = 'in_review', is_active = FALSE "
                "WHERE set_id = %s AND user_id = %s",
                (set_row["set_id"], user_id),
            )
            set_row["status"] = "in_review"

    return {
        "id": str(flashcard_id),
        "name": word_row["word"],
        "drawing": body.drawing,
        "setId": str(set_row["set_id"]),
        "setName": set_row["name"],
        "setStatus": set_row["status"],
        "setCardNumber": card_count,
        "setCompleted": set_row["status"] == "in_review",
    }


@app.post("/api/quiz/answer")
def record_quiz_answer(body: QuizAnswerRequest, request: Request) -> dict[str, Any]:
    user_id = authenticated_user_id(request)
    if body.selected_flashcard_id != body.flashcard_id:
        raise HTTPException(status_code=400, detail="The selected answer is not correct.")

    reward_reason = f"quiz_correct:{body.set_id}:{body.flashcard_id}"
    with get_connection("record correct quiz answer") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT total_coins FROM profiles WHERE user_id = %s FOR UPDATE",
            (user_id,),
        )
        profile = cursor.fetchone()
        if profile is None:
            raise HTTPException(status_code=404, detail="Profile not found.")

        cursor.execute(
            "SELECT 1 FROM flashcard f "
            "JOIN user_flashcard_sets s ON s.user_id = f.user_id AND s.set_id = f.set_id "
            "WHERE f.user_id = %s AND f.set_id = %s AND f.flashcard_id = %s "
            "AND s.status = 'in_review'",
            (user_id, str(body.set_id), str(body.flashcard_id)),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="That quiz card was not found in a review set.")

        cursor.execute(
            "SELECT transaction_id FROM coin_transactions "
            "WHERE user_id = %s AND reason = %s",
            (user_id, reward_reason),
        )
        was_awarded = cursor.fetchone() is None
        if was_awarded:
            cursor.execute(
                "INSERT INTO coin_transactions (user_id, amount, reason) "
                "VALUES (%s, %s, %s)",
                (user_id, QUIZ_COIN_REWARD, reward_reason),
            )
            cursor.execute(
                "UPDATE profiles SET total_coins = total_coins + %s "
                "WHERE user_id = %s RETURNING total_coins",
                (QUIZ_COIN_REWARD, user_id),
            )
            total_coins = cursor.fetchone()["total_coins"]
        else:
            total_coins = profile["total_coins"]

    return {"coins": total_coins, "coins_awarded": was_awarded, "amount": QUIZ_COIN_REWARD if was_awarded else 0}


@app.get("/api/store/purchases")
def get_store_purchases(request: Request) -> list[dict[str, Any]]:
    user_id = authenticated_user_id(request)
    with get_connection("fetch store purchases") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT item_id AS id, item_name AS name, coin_cost AS price "
            "FROM user_store_purchases WHERE user_id = %s ORDER BY purchased_at",
            (user_id,),
        )
        rows = cursor.fetchall()
    return [dict(row) for row in rows]


@app.post("/api/store/purchases", status_code=201)
def purchase_store_item(body: StorePurchaseRequest, request: Request) -> dict[str, Any]:
    user_id = authenticated_user_id(request)
    item = STORE_CATALOG.get(body.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="That store item is not available.")
    item_name, coin_cost = item

    with get_connection("purchase store item") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT total_coins FROM profiles WHERE user_id = %s FOR UPDATE",
            (user_id,),
        )
        profile = cursor.fetchone()
        if profile is None:
            raise HTTPException(status_code=404, detail="Profile not found.")

        cursor.execute(
            "SELECT 1 FROM user_store_purchases WHERE user_id = %s AND item_id = %s",
            (user_id, body.item_id),
        )
        if cursor.fetchone() is not None:
            raise HTTPException(status_code=409, detail="You already own this item.")
        if profile["total_coins"] < coin_cost:
            raise HTTPException(status_code=400, detail="You do not have enough coins for this item.")

        cursor.execute(
            "INSERT INTO user_store_purchases (user_id, item_id, item_name, coin_cost) "
            "VALUES (%s, %s, %s, %s)",
            (user_id, body.item_id, item_name, coin_cost),
        )
        cursor.execute(
            "INSERT INTO coin_transactions (user_id, amount, reason) VALUES (%s, %s, %s)",
            (user_id, -coin_cost, f"store_purchase:{body.item_id}"),
        )
        cursor.execute(
            "UPDATE profiles SET total_coins = total_coins - %s "
            "WHERE user_id = %s RETURNING total_coins",
            (coin_cost, user_id),
        )
        total_coins = cursor.fetchone()["total_coins"]

    return {
        "coins": total_coins,
        "item": {"id": body.item_id, "name": item_name, "price": coin_cost},
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
