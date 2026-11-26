"""Offline tests for account privacy and ownership.

No database, Redis, or network is used: the session store and database
connection are replaced with in-memory fakes.
"""
import os
import unittest
from contextlib import contextmanager
from unittest.mock import patch

# Force empty settings before importing the app so load_dotenv (which never
# overrides existing variables) cannot point the tests at a real service.
os.environ["DATABASE_URL"] = ""
os.environ["REDIS_URL"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from api import main  # noqa: E402

PNG = "data:image/png;base64,iVBORw0KGgo="
WORD_ID = "11111111-1111-1111-1111-111111111111"


class FakeSessionStore:
    def __init__(self, sessions):
        self.sessions = {main.session_key(token): user_id for token, user_id in sessions.items()}

    def get(self, key):
        return self.sessions.get(key)


class FakeCursor:
    def __init__(self, log, results):
        self.log = log
        self.results = results

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.log.append((" ".join(sql.split()), params))

    def fetchone(self):
        return self.results.pop(0) if self.results else None

    def fetchall(self):
        return []


class FakeConnection:
    def __init__(self, log, results):
        self.log = log
        self.results = results

    def cursor(self):
        return FakeCursor(self.log, self.results)


def fake_connection_factory(log, results=None):
    results = list(results or [])

    @contextmanager
    def get_connection(action):
        yield FakeConnection(log, results)

    return get_connection


class AccountPrivacyTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.queries = []
        store = FakeSessionStore({"alice-token": "alice-id", "bob-token": "bob-id"})
        self.patches = [
            patch.object(main, "session_store", store),
            patch.object(main, "get_connection", fake_connection_factory(self.queries)),
        ]
        for active in self.patches:
            active.start()

    def tearDown(self):
        for active in self.patches:
            active.stop()

    def test_user_list_endpoint_is_removed(self):
        self.assertEqual(self.client.get("/api/users").status_code, 404)
        self.assertEqual(self.client.get("/api/users", cookies={main.SESSION_COOKIE: "alice-token"}).status_code, 404)
        self.assertNotIn("/api/users", {route.path for route in main.app.routes})

    def test_flashcards_require_a_session(self):
        self.assertEqual(self.client.get("/api/flashcards").status_code, 401)
        self.assertEqual(
            self.client.get("/api/flashcards", cookies={main.SESSION_COOKIE: "expired-token"}).status_code, 401,
        )
        self.assertEqual(self.queries, [], "no database query should run without a valid session")

    def test_flashcard_list_is_scoped_to_the_session_account(self):
        response = self.client.get("/api/flashcards", cookies={main.SESSION_COOKIE: "bob-token"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.queries), 1)
        sql, params = self.queries[0]
        self.assertIn("WHERE f.user_id = %s", sql)
        self.assertEqual(params, ("bob-id",))

    def test_saving_a_flashcard_uses_the_session_account_not_the_request(self):
        # Account lock, the word exists, no existing card, an open set, the new card id,
        # the reward ledger entry, and the new balance.
        results = [
            {"user_id": "alice-id"}, {"word": "time", "word_id": WORD_ID}, None,
            {"set_id": "set-1", "name": "My Flash Cards"}, {"flashcard_id": "card-1"},
            {"entry_id": 1}, {"balance": 10},
        ]
        with patch.object(main, "get_connection", fake_connection_factory(self.queries, results)):
            response = self.client.post(
                "/api/flashcards",
                cookies={main.SESSION_COOKIE: "alice-token"},
                json={"word_id": WORD_ID, "drawing": PNG, "user_id": "bob-id"},
            )
        self.assertEqual(response.status_code, 201)
        user_params = [params[0] for sql, params in self.queries if "user_id" in sql and params]
        self.assertTrue(user_params)
        self.assertTrue(all(value == "alice-id" for value in user_params), user_params)

    def test_saving_a_flashcard_requires_a_session(self):
        response = self.client.post("/api/flashcards", json={"word_id": WORD_ID, "drawing": PNG})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.queries, [])

    def test_next_word_requires_a_session(self):
        self.assertEqual(self.client.get("/api/words/next").status_code, 401)


if __name__ == "__main__":
    unittest.main()
