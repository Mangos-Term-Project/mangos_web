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
from uuid import UUID, uuid4

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
    from . import email_service
    from .image_search import ImageSearchError, fetch_images
    from .review_schedule import CARD_CREATED_REWARD, REVIEW_PROGRESS_REWARD, next_review
except ImportError:
    import email_service
    from image_search import ImageSearchError, fetch_images
    from review_schedule import CARD_CREATED_REWARD, REVIEW_PROGRESS_REWARD, next_review

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

CARDS_PER_SET = 10
PET_ID_PATTERN = re.compile(r"[a-z0-9_]{1,40}")

redis_options: dict[str, Any] = {"decode_responses": True}
if REDIS_URL.startswith("rediss://"):
    # TLS settings apply only to TLS URLs; a plain local redis:// URL rejects them.
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
    email: str | None = Field(default=None, max_length=254)


class LoginRequest(BaseModel):
    username: str
    password: str


class FlashCardRequest(BaseModel):
    word_id: UUID
    drawing: str = Field(max_length=2_000_000)


class DrawingUpdateRequest(BaseModel):
    drawing: str = Field(max_length=2_000_000)


class ReviewRequest(BaseModel):
    source: str = Field(pattern="^(review|quiz)$")
    remembered: bool | None = None
    chosen_flashcard_id: UUID | None = None


class EmailRequest(BaseModel):
    email: str = Field(max_length=254)


class EmailCodeRequest(BaseModel):
    code: str = Field(max_length=12)


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


def user_response(row: dict[str, Any], email_verified: bool) -> dict[str, Any]:
    return {
        "user_id": str(row["user_id"]),
        "username": row["username"],
        "name": row["name"] or row["username"],
        "email_verified": email_verified,
        "email_required": email_service.verification_required(),
    }


def has_verified_email(cursor: Any, user_id: Any) -> bool:
    cursor.execute("SELECT 1 FROM user_emails WHERE user_id = %s", (str(user_id),))
    return cursor.fetchone() is not None


def authenticated_user_id(request: Request) -> str:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in.")

    with get_session_store("fetch session") as store:
        user_id = store.get(session_key(token))
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not logged in.")
    return user_id


def verified_user_id(request: Request) -> str:
    """Like authenticated_user_id, but also requires a verified email while verification is on.

    Account, email and sign-in endpoints use authenticated_user_id so an
    unverified account can still add and verify its email.
    """
    user_id = authenticated_user_id(request)
    if email_service.verification_required():
        with get_connection("check email verification") as connection, connection.cursor() as cursor:
            verified = has_verified_email(cursor, user_id)
        if not verified:
            raise HTTPException(status_code=403, detail="Please verify your email to continue.")
    return user_id


def require_png(drawing: str) -> None:
    if not drawing.startswith("data:image/png;base64,"):
        raise HTTPException(status_code=400, detail="The drawing must be a PNG image.")


def award_coins(cursor: Any, user_id: str, amount: int, reason: str, source_key: str) -> bool:
    """Pay a reward once per (account, source_key). Returns False if it was already paid."""
    cursor.execute(
        "INSERT INTO coin_ledger (user_id, amount, reason, source_key) VALUES (%s, %s, %s, %s) "
        "ON CONFLICT (user_id, source_key) DO NOTHING RETURNING entry_id",
        (user_id, amount, reason, source_key),
    )
    if cursor.fetchone() is None:
        return False
    cursor.execute(
        "INSERT INTO coin_wallets (user_id, balance) VALUES (%s, %s) "
        "ON CONFLICT (user_id) DO UPDATE SET balance = coin_wallets.balance + EXCLUDED.balance, updated_at = now()",
        (user_id, amount),
    )
    return True


def coin_balance(cursor: Any, user_id: str) -> int:
    cursor.execute("SELECT balance FROM coin_wallets WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    return row["balance"] if row else 0


def owned_flashcard(cursor: Any, user_id: str, flashcard_id: str) -> None:
    """404 unless the card belongs to this account, so other accounts' cards look missing."""
    cursor.execute(
        "SELECT 1 FROM flashcard WHERE flashcard_id = %s AND user_id = %s",
        (flashcard_id, user_id),
    )
    if cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="That flash card could not be found.")


def isoformat(value: Any) -> str | None:
    return value.isoformat() if value is not None else None


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterRequest, request: Request, response: Response) -> dict[str, Any]:
    name = body.name.strip()
    username = body.username.strip().lower()
    password = body.password
    email = None
    if email_service.verification_required():
        email = email_service.normalize_email(body.email or "")
        if email is None:
            raise HTTPException(status_code=400, detail="Please enter a valid email address.")

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
    result = user_response({"user_id": user_id, "username": username, "name": name}, email_verified=False)
    if email is not None:
        # The account is already saved. If the email cannot be sent, the
        # learner can ask for a new code from the verification screen.
        try:
            result["email_code"] = issue_email_code(str(user_id), email)
        except HTTPException as error:
            result["email_code"] = {"sent": False, "detail": error.detail}
    return result


@app.post("/api/auth/login")
def login(body: LoginRequest, request: Request, response: Response) -> dict[str, Any]:
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
        verified = has_verified_email(cursor, row["user_id"])

    set_session_cookie(response, request, token)
    return user_response(row, email_verified=verified)


@app.get("/api/auth/me")
def get_current_user(request: Request) -> dict[str, Any]:
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
        verified = has_verified_email(cursor, user_id) if row is not None else False

    if row is None:
        raise HTTPException(status_code=401, detail="Not logged in.")
    return user_response(row, email_verified=verified)


@app.get("/api/images/search")
def search_images(
    request: Request,
    q: str = Query(min_length=1, max_length=80),
    image_type: str = Query(default="all", pattern="^(all|photo|illustration|vector)$"),
):
    user_id = verified_user_id(request)
    query = " ".join(q.split()).casefold()
    if not query:
        raise HTTPException(status_code=400, detail="Enter a word to search.")
    key = os.getenv("PIXABAY_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="Picture search is not configured yet.")
    # v3: results now depend on the picture type as well as the words.
    cache_key = f"mangos:images:v3:{image_type}:{hash_token(query)}"
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


@app.get("/api/words/next")
def get_next_word(
    request: Request,
    exclude_words: list[str] = Query(default=[]),
) -> dict[str, str] | None:
    user_id = verified_user_id(request)
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
def get_flashcards(request: Request) -> list[dict[str, Any]]:
    user_id = verified_user_id(request)
    with get_connection("fetch flash cards") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT f.flashcard_id, w.word, p.drawing_url, f.set_id, s.name AS set_name, "
            "  r.box, r.due_at "
            "FROM flashcard f "
            "JOIN word w ON w.word_id = f.word_id "
            "LEFT JOIN user_flashcard_progress p "
            "  ON p.user_id = f.user_id AND p.flashcard_id = f.flashcard_id "
            "LEFT JOIN user_flashcard_sets s ON s.set_id = f.set_id AND s.user_id = f.user_id "
            "LEFT JOIN flashcard_review_state r ON r.flashcard_id = f.flashcard_id AND r.user_id = f.user_id "
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
            "set_id": str(row["set_id"]) if row["set_id"] is not None else None,
            "set_name": row["set_name"] or "My Flash Cards",
            "box": row["box"] or 0,
            # A card that has never been reviewed is due now.
            "due_at": isoformat(row["due_at"]),
        }
        for row in rows
    ]


@app.post("/api/flashcards", status_code=201)
def create_flashcard(body: FlashCardRequest, request: Request) -> dict[str, Any]:
    user_id = verified_user_id(request)
    word_id = str(body.word_id)
    require_png(body.drawing)

    with get_connection("create flash card") as connection, connection.cursor() as cursor:
        # Serialize card creation per account so set filling and rewards stay consistent.
        cursor.execute("SELECT user_id FROM users WHERE user_id = %s FOR UPDATE", (user_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=401, detail="Not logged in.")
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

        # Fill sets of CARDS_PER_SET cards; start a new numbered set when they are full.
        cursor.execute(
            "SELECT s.set_id, s.name FROM user_flashcard_sets s "
            "LEFT JOIN flashcard f ON f.set_id = s.set_id AND f.user_id = s.user_id "
            "WHERE s.user_id = %s AND s.is_active IS TRUE "
            "GROUP BY s.set_id, s.name "
            "HAVING COUNT(f.flashcard_id) < %s "
            "ORDER BY COUNT(f.flashcard_id) DESC, s.name LIMIT 1",
            (user_id, CARDS_PER_SET),
        )
        set_row = cursor.fetchone()
        if set_row is None:
            cursor.execute("SELECT COUNT(*) AS total FROM user_flashcard_sets WHERE user_id = %s", (user_id,))
            existing_sets = cursor.fetchone()["total"]
            cursor.execute(
                "INSERT INTO user_flashcard_sets (user_id, name, is_active) "
                "VALUES (%s, %s, TRUE) RETURNING set_id, name",
                (user_id, "My Flash Cards" if existing_sets == 0 else f"Set {existing_sets + 1}"),
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
        # Keyed by word, so a card for the same word can never pay twice.
        coins_awarded = CARD_CREATED_REWARD if award_coins(
            cursor, user_id, CARD_CREATED_REWARD, "card_created", f"card:{word_id}",
        ) else 0
        coins = coin_balance(cursor, user_id)

    return {
        "id": str(flashcard_id),
        "name": word_row["word"],
        "drawing": body.drawing,
        "set_id": str(set_row["set_id"]),
        "set_name": set_row["name"],
        "box": 0,
        "due_at": None,
        "coins_awarded": coins_awarded,
        "coins": coins,
    }


@app.put("/api/flashcards/{flashcard_id}/drawing")
def update_drawing(flashcard_id: UUID, body: DrawingUpdateRequest, request: Request) -> dict[str, str]:
    user_id = verified_user_id(request)
    require_png(body.drawing)
    with get_connection("update drawing") as connection, connection.cursor() as cursor:
        owned_flashcard(cursor, user_id, str(flashcard_id))
        cursor.execute(
            "UPDATE user_flashcard_progress SET drawing_url = %s "
            "WHERE user_id = %s AND flashcard_id = %s RETURNING flashcard_id",
            (body.drawing, user_id, str(flashcard_id)),
        )
        if cursor.fetchone() is None:
            cursor.execute(
                "INSERT INTO user_flashcard_progress (user_id, flashcard_id, drawing_url) VALUES (%s, %s, %s)",
                (user_id, str(flashcard_id), body.drawing),
            )
    # Editing a drawing never pays coins.
    return {"id": str(flashcard_id), "drawing": body.drawing}


@app.post("/api/flashcards/{flashcard_id}/reviews")
def record_review(flashcard_id: UUID, body: ReviewRequest, request: Request) -> dict[str, Any]:
    user_id = verified_user_id(request)
    card_id = str(flashcard_id)
    if body.source == "quiz" and body.chosen_flashcard_id is None:
        raise HTTPException(status_code=400, detail="A quiz answer needs the chosen picture.")
    if body.source == "review" and body.remembered is None:
        raise HTTPException(status_code=400, detail="Say whether you remembered the word.")

    with get_connection("record review") as connection, connection.cursor() as cursor:
        owned_flashcard(cursor, user_id, card_id)
        if body.source == "quiz":
            chosen_id = str(body.chosen_flashcard_id)
            owned_flashcard(cursor, user_id, chosen_id)
            correct = chosen_id == card_id
        else:
            correct = bool(body.remembered)

        cursor.execute(
            "INSERT INTO flashcard_review_state (flashcard_id, user_id) VALUES (%s, %s) "
            "ON CONFLICT (flashcard_id) DO NOTHING",
            (card_id, user_id),
        )
        cursor.execute(
            "SELECT box, due_at, now() AS now FROM flashcard_review_state "
            "WHERE flashcard_id = %s AND user_id = %s FOR UPDATE",
            (card_id, user_id),
        )
        state = cursor.fetchone()
        outcome = next_review(state["box"], state["due_at"], correct, state["now"], card_id)
        cursor.execute(
            "UPDATE flashcard_review_state SET box = %s, due_at = %s, last_reviewed_at = now(), "
            "review_count = review_count + 1, correct_count = correct_count + %s "
            "WHERE flashcard_id = %s AND user_id = %s",
            (outcome.box, outcome.due_at, 1 if correct else 0, card_id, user_id),
        )
        cursor.execute(
            "INSERT INTO flashcard_review_log (user_id, flashcard_id, source, correct, was_due) "
            "VALUES (%s, %s, %s, %s, %s)",
            (user_id, card_id, body.source, correct, outcome.schedule_changed),
        )
        coins_awarded = 0
        if outcome.reward_key and award_coins(
            cursor, user_id, REVIEW_PROGRESS_REWARD, "review_progress", outcome.reward_key,
        ):
            coins_awarded = REVIEW_PROGRESS_REWARD
        coins = coin_balance(cursor, user_id)

    return {
        "correct": correct,
        "was_due": outcome.schedule_changed,
        "box": outcome.box,
        "due_at": isoformat(outcome.due_at),
        "coins_awarded": coins_awarded,
        "coins": coins,
    }


def email_status(cursor: Any, user_id: str) -> dict[str, Any]:
    cursor.execute("SELECT email FROM user_emails WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    # A code that can still be used, so the verify screen survives a reload.
    cursor.execute(
        "SELECT email FROM email_verification_codes WHERE user_id = %s AND used_at IS NULL "
        "AND expires_at > now() AND attempts < %s ORDER BY created_at DESC LIMIT 1",
        (user_id, email_service.MAX_ATTEMPTS_PER_CODE),
    )
    pending = cursor.fetchone()
    return {
        "feature_enabled": email_service.feature_enabled(),
        "verified": row is not None,
        "email_masked": email_service.mask_email(row["email"]) if row else None,
        "code_active": pending is not None,
        "pending_email_masked": email_service.mask_email(pending["email"]) if pending else None,
    }


@app.get("/api/account")
def get_account(request: Request) -> dict[str, Any]:
    user_id = authenticated_user_id(request)
    with get_connection("fetch account") as connection, connection.cursor() as cursor:
        coins = coin_balance(cursor, user_id)
        cursor.execute(
            "SELECT p.pet_id, p.name, up.purchased_at FROM user_pets up "
            "JOIN pets p ON p.pet_id = up.pet_id WHERE up.user_id = %s ORDER BY up.purchased_at",
            (user_id,),
        )
        pets = [
            {"id": row["pet_id"], "name": row["name"], "purchased_at": isoformat(row["purchased_at"])}
            for row in cursor.fetchall()
        ]
        email = email_status(cursor, user_id)
    return {"coins": coins, "pets": pets, "email": email}


@app.get("/api/pets")
def list_pets(request: Request) -> list[dict[str, Any]]:
    user_id = verified_user_id(request)
    with get_connection("fetch pets") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT p.pet_id, p.name, p.price, (up.user_id IS NOT NULL) AS owned FROM pets p "
            "LEFT JOIN user_pets up ON up.pet_id = p.pet_id AND up.user_id = %s "
            "WHERE p.is_available IS TRUE ORDER BY p.sort_order, p.pet_id",
            (user_id,),
        )
        rows = cursor.fetchall()
    return [{"id": r["pet_id"], "name": r["name"], "price": r["price"], "owned": r["owned"]} for r in rows]


@app.post("/api/pets/{pet_id}/purchase")
def purchase_pet(pet_id: str, request: Request) -> dict[str, Any]:
    user_id = verified_user_id(request)
    if not PET_ID_PATTERN.fullmatch(pet_id):
        raise HTTPException(status_code=404, detail="That pet could not be found.")

    shortfall = None
    with get_connection("purchase pet") as connection, connection.cursor() as cursor:
        cursor.execute("SELECT name, price FROM pets WHERE pet_id = %s AND is_available IS TRUE", (pet_id,))
        pet = cursor.fetchone()
        if pet is None:
            raise HTTPException(status_code=404, detail="That pet could not be found.")
        # The primary key on user_pets makes a second purchase of the same pet impossible,
        # even for two requests at the same moment.
        cursor.execute(
            "INSERT INTO user_pets (user_id, pet_id) VALUES (%s, %s) ON CONFLICT DO NOTHING RETURNING pet_id",
            (user_id, pet_id),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=409, detail="You already have this pet.")
        # Deduct only if the balance covers the price; otherwise the whole purchase rolls back.
        cursor.execute(
            "UPDATE coin_wallets SET balance = balance - %s, updated_at = now() "
            "WHERE user_id = %s AND balance >= %s RETURNING balance",
            (pet["price"], user_id, pet["price"]),
        )
        wallet = cursor.fetchone()
        if wallet is None:
            shortfall = pet["price"] - coin_balance(cursor, user_id)
            raise HTTPException(status_code=409, detail=f"You need {shortfall} more coins for this pet.")
        cursor.execute(
            "INSERT INTO coin_ledger (user_id, amount, reason, source_key) VALUES (%s, %s, 'pet_purchase', %s)",
            (user_id, -pet["price"], f"pet:{pet_id}"),
        )
    return {"pet": {"id": pet_id, "name": pet["name"]}, "coins": wallet["balance"]}


def require_email_feature() -> None:
    if not email_service.feature_enabled():
        raise HTTPException(status_code=503, detail="Email verification is turned off on this server.")
    try:
        email_service.smtp_settings()
    except email_service.EmailNotConfigured:
        raise HTTPException(status_code=503, detail="Email sending is not set up on this server yet.") from None


@app.get("/api/auth/config")
def auth_config() -> dict[str, bool]:
    return {"email_verification_required": email_service.verification_required()}


@app.post("/api/account/email")
def request_email_code(body: EmailRequest, request: Request) -> dict[str, Any]:
    user_id = authenticated_user_id(request)
    require_email_feature()
    email = email_service.normalize_email(body.email)
    if email is None:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    return issue_email_code(user_id, email)


def issue_email_code(user_id: str, email: str) -> dict[str, Any]:
    """Create and send a new code, enforcing the resend limits. Raises HTTPException on failure."""
    require_email_feature()
    with get_connection("send email code") as connection, connection.cursor() as cursor:
        # Lock the account row so two quick requests cannot both pass the limits.
        cursor.execute("SELECT user_id FROM users WHERE user_id = %s FOR UPDATE", (user_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=401, detail="Not logged in.")
        cursor.execute(
            "SELECT COUNT(*) AS recent, "
            "  COALESCE(EXTRACT(EPOCH FROM now() - MAX(created_at)), 1e9) AS seconds_since_last "
            "FROM email_verification_codes WHERE user_id = %s AND created_at > now() - interval '1 hour'",
            (user_id,),
        )
        limits = cursor.fetchone()
        if limits["seconds_since_last"] < email_service.RESEND_COOLDOWN_SECONDS:
            raise HTTPException(status_code=429, detail="Please wait a minute before asking for another code.")
        if limits["recent"] >= email_service.MAX_CODES_PER_HOUR:
            raise HTTPException(status_code=429, detail="Too many codes this hour. Please try again later.")

        # A new code replaces any earlier one.
        cursor.execute(
            "UPDATE email_verification_codes SET used_at = now() WHERE user_id = %s AND used_at IS NULL",
            (user_id,),
        )
        code_id = str(uuid4())
        code = email_service.generate_code()
        cursor.execute(
            "INSERT INTO email_verification_codes (code_id, user_id, email, code_hash, expires_at) "
            "VALUES (%s, %s, %s, %s, now() + make_interval(mins => %s))",
            (code_id, user_id, email, email_service.hash_code(code_id, code), email_service.CODE_TTL_MINUTES),
        )
        try:
            email_service.send_verification_email(email, code)
        except email_service.EmailDeliveryFailed:
            # Rolls back the new code, so nothing is stored for an email that was not sent.
            raise HTTPException(status_code=502, detail="We could not send the email. Please try again later.") from None

    return {
        "sent": True,
        "email_masked": email_service.mask_email(email),
        "expires_in_minutes": email_service.CODE_TTL_MINUTES,
    }


@app.post("/api/account/email/verify")
def verify_email_code(body: EmailCodeRequest, request: Request) -> dict[str, Any]:
    user_id = authenticated_user_id(request)
    require_email_feature()
    code = body.code.strip()
    if not re.fullmatch(r"\d{%d}" % email_service.CODE_LENGTH, code):
        raise HTTPException(status_code=400, detail="Enter the 6-digit code from the email.")

    failure: HTTPException | None = None
    with get_connection("verify email code") as connection, connection.cursor() as cursor:
        cursor.execute(
            "SELECT code_id, email, code_hash, attempts, (expires_at <= now()) AS expired "
            "FROM email_verification_codes WHERE user_id = %s AND used_at IS NULL "
            "ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
            (user_id,),
        )
        row = cursor.fetchone()
        if row is None:
            failure = HTTPException(status_code=400, detail="There is no active code. Ask for a new one.")
        elif row["expired"]:
            failure = HTTPException(status_code=400, detail="That code has expired. Ask for a new one.")
        elif row["attempts"] >= email_service.MAX_ATTEMPTS_PER_CODE:
            failure = HTTPException(status_code=429, detail="Too many wrong tries. Ask for a new code.")
        elif not email_service.code_matches(str(row["code_id"]), code, row["code_hash"]):
            # Saved even though the request fails, so wrong guesses always count.
            cursor.execute(
                "UPDATE email_verification_codes SET attempts = attempts + 1 WHERE code_id = %s",
                (row["code_id"],),
            )
            left = email_service.MAX_ATTEMPTS_PER_CODE - row["attempts"] - 1
            failure = HTTPException(
                status_code=400 if left > 0 else 429,
                detail=f"That code is not right. {left} tries left." if left > 0
                else "Too many wrong tries. Ask for a new code.",
            )
        else:
            cursor.execute("UPDATE email_verification_codes SET used_at = now() WHERE code_id = %s", (row["code_id"],))
            cursor.execute(
                "INSERT INTO user_emails (user_id, email, verified_at) VALUES (%s, %s, now()) "
                "ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, verified_at = now()",
                (user_id, row["email"]),
            )
            status = email_status(cursor, user_id)
    if failure is not None:
        raise failure
    return status


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
