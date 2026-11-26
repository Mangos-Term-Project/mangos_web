"""Integration tests against a LOCAL PostgreSQL database (docker-compose.local.yml).

Run from the repository root:
    python api/db/setup_local_db.py --database mangos_test
    MANGOS_TEST_DATABASE_URL=postgresql://mangos:mangos_local_only@127.0.0.1:55432/mangos_test \
        python -m pytest tests/integration -v

Skipped when MANGOS_TEST_DATABASE_URL is not set. Refuses any non-local host.
Every test starts from empty account tables (the word list is kept).
"""
import json
import os
import re
import threading
import time
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit
from urllib.request import urlopen

os.environ.setdefault("DATABASE_URL", "")
os.environ.setdefault("REDIS_URL", "")

import psycopg2  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from api import email_service, main  # noqa: E402

TEST_DATABASE_URL = os.getenv("MANGOS_TEST_DATABASE_URL", "")
PNG = "data:image/png;base64,iVBORw0KGgo="
PNG_EDITED = "data:image/png;base64,iVBORw0KGgoEDITED="
MAILPIT_API = "http://127.0.0.1:18025/api/v1"

if TEST_DATABASE_URL and urlsplit(TEST_DATABASE_URL).hostname not in {"127.0.0.1", "localhost"}:
    raise RuntimeError("Integration tests only run against a local database.")


class MemorySessionStore:
    def __init__(self):
        self.values = {}

    def set(self, key, value, ex=None):
        self.values[key] = value

    def get(self, key):
        return self.values.get(key)

    def delete(self, key):
        self.values.pop(key, None)


def db():
    return psycopg2.connect(TEST_DATABASE_URL)


def sql(statement, params=()):
    with db() as connection, connection.cursor() as cursor:
        cursor.execute(statement, params)
        return cursor.fetchall() if cursor.description else None


@unittest.skipUnless(TEST_DATABASE_URL, "set MANGOS_TEST_DATABASE_URL to run database integration tests")
class SavedFeatureTests(unittest.TestCase):
    def setUp(self):
        sql("TRUNCATE users CASCADE")
        self.patches = [
            patch.object(main, "DATABASE_URL", TEST_DATABASE_URL),
            patch.object(main, "session_store", MemorySessionStore()),
        ]
        for active in self.patches:
            active.start()
        self.words = [str(row[0]) for row in sql("SELECT word_id FROM word ORDER BY word LIMIT 15")]
        self.alice = self.account("alice")
        self.bob = self.account("bob")

    def tearDown(self):
        for active in self.patches:
            active.stop()

    def account(self, username):
        client = TestClient(main.app, base_url="http://localhost")
        response = client.post("/api/auth/register", json={"name": username.title(), "username": username,
                                                           "password": "correct horse"})
        self.assertEqual(response.status_code, 201, response.text)
        return client

    def make_card(self, client, word_index):
        return client.post("/api/flashcards", json={"word_id": self.words[word_index], "drawing": PNG})

    def coins(self, client):
        return client.get("/api/account").json()["coins"]

    def give_coins(self, client, amount):
        user_id = client.get("/api/auth/me").json()["user_id"]
        sql("INSERT INTO coin_wallets (user_id, balance) VALUES (%s, %s) "
            "ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance", (user_id, amount))

    # Coins and rewards

    def test_card_reward_is_paid_once_per_word(self):
        self.assertEqual(self.coins(self.alice), 0)
        first = self.make_card(self.alice, 0)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json()["coins_awarded"], 10)
        self.assertEqual(self.make_card(self.alice, 0).status_code, 409)
        self.assertEqual(self.coins(self.alice), 10)
        self.assertEqual(self.make_card(self.alice, 1).json()["coins"], 20)
        self.assertEqual(sql("SELECT COUNT(*) FROM coin_ledger WHERE reason = 'card_created'")[0][0], 2)

    def test_editing_a_drawing_pays_nothing_and_saves_the_new_drawing(self):
        card = self.make_card(self.alice, 0).json()
        response = self.alice.put(f"/api/flashcards/{card['id']}/drawing", json={"drawing": PNG_EDITED})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.alice.get("/api/flashcards").json()[0]["drawing"], PNG_EDITED)
        self.assertEqual(self.coins(self.alice), 10)
        bad = self.alice.put(f"/api/flashcards/{card['id']}/drawing", json={"drawing": "data:text/html,hi"})
        self.assertEqual(bad.status_code, 400)

    # Purchases

    def test_purchase_needs_enough_coins_and_changes_nothing_when_short(self):
        self.give_coins(self.alice, 20)
        response = self.alice.post("/api/pets/puppy/purchase")
        self.assertEqual(response.status_code, 409)
        self.assertIn("5 more coins", response.json()["detail"])
        self.assertEqual(self.coins(self.alice), 20)
        self.assertEqual(self.alice.get("/api/account").json()["pets"], [])

    def test_purchase_deducts_the_price_and_cannot_repeat(self):
        self.give_coins(self.alice, 30)
        response = self.alice.post("/api/pets/puppy/purchase")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["coins"], 5)
        again = self.alice.post("/api/pets/puppy/purchase")
        self.assertEqual(again.status_code, 409)
        self.assertEqual(self.coins(self.alice), 5)
        account = self.alice.get("/api/account").json()
        self.assertEqual([pet["id"] for pet in account["pets"]], ["puppy"])
        owned = {pet["id"]: pet["owned"] for pet in self.alice.get("/api/pets").json()}
        self.assertTrue(owned["puppy"])
        self.assertFalse(owned["kitten"])

    def test_unknown_and_malformed_pets_are_rejected(self):
        self.give_coins(self.alice, 500)
        self.assertEqual(self.alice.post("/api/pets/dragon/purchase").status_code, 404)
        self.assertEqual(self.alice.post("/api/pets/DROP%20TABLE/purchase").status_code, 404)
        self.assertEqual(self.coins(self.alice), 500)

    def test_simultaneous_purchases_cannot_overspend_or_double_buy(self):
        self.give_coins(self.alice, 60)
        cookie = self.alice.cookies.get(main.SESSION_COOKIE)
        results = []

        def buy(pet):
            client = TestClient(main.app, base_url="http://localhost")
            client.cookies.set(main.SESSION_COOKIE, cookie)
            results.append((pet, client.post(f"/api/pets/{pet}/purchase").status_code))

        threads = [threading.Thread(target=buy, args=(pet,)) for pet in ("kitten", "bunny", "kitten", "bunny")]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        successes = [pet for pet, status in results if status == 200]
        self.assertEqual(len(successes), 1, results)
        balance = self.coins(self.alice)
        self.assertEqual(balance, 60 - {"kitten": 40, "bunny": 55}[successes[0]])
        spent = -sql("SELECT COALESCE(SUM(amount), 0) FROM coin_ledger WHERE reason = 'pet_purchase'")[0][0]
        self.assertEqual(60 - spent, balance)

    def test_purchases_require_login(self):
        anonymous = TestClient(main.app, base_url="http://localhost")
        self.assertEqual(anonymous.post("/api/pets/puppy/purchase").status_code, 401)
        self.assertEqual(anonymous.get("/api/account").status_code, 401)

    # Reviews and schedule

    def test_review_schedule_and_rewards_cannot_be_farmed(self):
        cards = [self.make_card(self.alice, index).json() for index in range(4)]
        target, other = cards[0]["id"], cards[1]["id"]
        url = f"/api/flashcards/{target}/reviews"

        first = self.alice.post(url, json={"source": "quiz", "chosen_flashcard_id": target}).json()
        self.assertEqual((first["correct"], first["was_due"], first["box"], first["coins_awarded"]), (True, True, 1, 2))

        early = self.alice.post(url, json={"source": "quiz", "chosen_flashcard_id": target}).json()
        self.assertEqual((early["was_due"], early["box"], early["coins_awarded"]), (False, 1, 0))

        sql("UPDATE flashcard_review_state SET due_at = now() - interval '1 minute' WHERE flashcard_id = %s", (target,))
        wrong = self.alice.post(url, json={"source": "quiz", "chosen_flashcard_id": other}).json()
        self.assertEqual((wrong["correct"], wrong["box"], wrong["coins_awarded"]), (False, 0, 0))

        # Back to box 1, which already paid once: no second reward.
        again = self.alice.post(url, json={"source": "review", "remembered": True}).json()
        self.assertEqual((again["box"], again["coins_awarded"]), (1, 0))

        log = sql("SELECT source, correct, was_due FROM flashcard_review_log ORDER BY review_id")
        self.assertEqual(log, [("quiz", True, True), ("quiz", True, False), ("quiz", False, True), ("review", True, True)])
        self.assertEqual(self.coins(self.alice), 4 * 10 + 2)

    def test_review_intervals_follow_the_schedule(self):
        target = self.make_card(self.alice, 0).json()["id"]
        url = f"/api/flashcards/{target}/reviews"
        gaps = []
        for _ in range(7):
            sql("UPDATE flashcard_review_state SET due_at = now() - interval '1 second' WHERE flashcard_id = %s",
                (target,))
            self.alice.post(url, json={"source": "review", "remembered": True})
            gaps.append(sql("SELECT box, round(EXTRACT(EPOCH FROM due_at - last_reviewed_at) / 86400) "
                            "FROM flashcard_review_state WHERE flashcard_id = %s", (target,))[0])
        self.assertEqual([(box, int(days)) for box, days in gaps],
                         [(1, 1), (2, 2), (3, 4), (4, 7), (5, 14), (6, 30), (6, 30)])
        self.assertEqual(self.coins(self.alice), 10 + 6 * 2)

    def test_review_input_is_validated(self):
        target = self.make_card(self.alice, 0).json()["id"]
        url = f"/api/flashcards/{target}/reviews"
        self.assertEqual(self.alice.post(url, json={"source": "quiz"}).status_code, 400)
        self.assertEqual(self.alice.post(url, json={"source": "review"}).status_code, 400)
        self.assertEqual(self.alice.post(url, json={"source": "hack", "remembered": True}).status_code, 422)
        self.assertEqual(self.alice.post("/api/flashcards/not-a-uuid/reviews",
                                         json={"source": "review", "remembered": True}).status_code, 422)

    # Ownership

    def test_accounts_cannot_see_review_or_edit_each_others_cards(self):
        alice_card = self.make_card(self.alice, 0).json()["id"]
        bob_card = self.make_card(self.bob, 1).json()["id"]

        self.assertEqual([card["id"] for card in self.bob.get("/api/flashcards").json()], [bob_card])
        self.assertEqual(self.bob.post(f"/api/flashcards/{alice_card}/reviews",
                                       json={"source": "review", "remembered": True}).status_code, 404)
        self.assertEqual(self.bob.put(f"/api/flashcards/{alice_card}/drawing",
                                      json={"drawing": PNG_EDITED}).status_code, 404)
        # Bob cannot point his own quiz answer at Alice's card either.
        self.assertEqual(self.bob.post(f"/api/flashcards/{bob_card}/reviews",
                                       json={"source": "quiz", "chosen_flashcard_id": alice_card}).status_code, 404)
        self.assertEqual(self.alice.get("/api/flashcards").json()[0]["drawing"], PNG)
        self.assertEqual(sql("SELECT COUNT(*) FROM flashcard_review_log")[0][0], 0)

    # Sets

    def test_cards_are_grouped_into_sets_of_ten(self):
        for index in range(11):
            self.assertEqual(self.make_card(self.alice, index).status_code, 201)
        sets = {}
        for card in self.alice.get("/api/flashcards").json():
            sets.setdefault(card["set_name"], 0)
            sets[card["set_name"]] += 1
        self.assertEqual(sets, {"My Flash Cards": 10, "Set 2": 1})

    # Email verification

    def email_settings(self, **overrides):
        values = {"EMAIL_VERIFICATION_ENABLED": "true", "SMTP_HOST": "127.0.0.1", "SMTP_PORT": "11025",
                  "SMTP_FROM": "Mangos <no-reply@mangos.test>", "SMTP_STARTTLS": "false"}
        values.update(overrides)
        return patch.dict(os.environ, values)

    def request_code(self, client, sent):
        with patch.object(email_service, "send_verification_email", lambda to, code: sent.append(code)):
            return client.post("/api/account/email", json={"email": "Parent@Example.COM"})

    def skip_cooldown(self):
        sql("UPDATE email_verification_codes SET created_at = created_at - interval '61 seconds'")

    def test_email_feature_reports_when_it_is_off_or_not_configured(self):
        with patch.dict(os.environ, {"EMAIL_VERIFICATION_ENABLED": "false"}):
            response = self.alice.post("/api/account/email", json={"email": "a@example.com"})
        self.assertEqual(response.status_code, 503)
        with self.email_settings(SMTP_HOST=""):
            response = self.alice.post("/api/account/email", json={"email": "a@example.com"})
        self.assertEqual(response.status_code, 503)
        self.assertIn("not set up", response.json()["detail"])
        self.assertEqual(sql("SELECT COUNT(*) FROM email_verification_codes")[0][0], 0)

    def test_email_code_is_single_use(self):
        sent = []
        with self.email_settings():
            self.assertEqual(self.request_code(self.alice, sent).status_code, 200)
            self.assertEqual(self.alice.post("/api/account/email/verify", json={"code": sent[0]}).status_code, 200)
            reused = self.alice.post("/api/account/email/verify", json={"code": sent[0]})
            account = self.alice.get("/api/account").json()["email"]
        self.assertEqual(reused.status_code, 400)
        self.assertEqual(account["verified"], True)
        self.assertEqual(account["email_masked"], "P*****@example.com")
        stored = sql("SELECT code_hash FROM email_verification_codes")[0][0]
        self.assertNotIn(sent[0], stored)

    def test_account_reports_a_waiting_code_so_a_reload_can_resume(self):
        sent = []
        with self.email_settings():
            self.assertFalse(self.alice.get("/api/account").json()["email"]["code_active"])
            self.request_code(self.alice, sent)
            waiting = self.alice.get("/api/account").json()["email"]
            self.alice.post("/api/account/email/verify", json={"code": sent[0]})
            done = self.alice.get("/api/account").json()["email"]
        self.assertTrue(waiting["code_active"])
        self.assertEqual(waiting["pending_email_masked"], "P*****@example.com")
        self.assertNotIn("Parent", str(waiting), "the full address is never returned")
        self.assertFalse(done["code_active"])
        self.assertTrue(done["verified"])

    def test_email_code_expires(self):
        sent = []
        with self.email_settings():
            self.request_code(self.alice, sent)
            sql("UPDATE email_verification_codes SET expires_at = now() - interval '1 second'")
            response = self.alice.post("/api/account/email/verify", json={"code": sent[0]})
        self.assertEqual(response.status_code, 400)
        self.assertIn("expired", response.json()["detail"])

    def test_email_code_attempt_limit(self):
        sent = []
        with self.email_settings():
            self.request_code(self.alice, sent)
            wrong = "000000" if sent[0] != "000000" else "111111"
            statuses = [self.alice.post("/api/account/email/verify", json={"code": wrong}).status_code
                        for _ in range(5)]
            after_limit = self.alice.post("/api/account/email/verify", json={"code": sent[0]})
        self.assertEqual(statuses, [400, 400, 400, 400, 429])
        self.assertEqual(after_limit.status_code, 429)
        self.assertFalse(self.alice.get("/api/account").json()["email"]["verified"])

    def test_email_resend_limits(self):
        sent = []
        with self.email_settings():
            self.assertEqual(self.request_code(self.alice, sent).status_code, 200)
            self.assertEqual(self.request_code(self.alice, sent).status_code, 429)  # cooldown
            self.skip_cooldown()
            self.assertEqual(self.request_code(self.alice, sent).status_code, 200)
            self.skip_cooldown()
            self.assertEqual(self.request_code(self.alice, sent).status_code, 200)
            self.skip_cooldown()
            fourth = self.request_code(self.alice, sent)
            # Only the newest code works.
            old = self.alice.post("/api/account/email/verify", json={"code": sent[0]})
        self.assertEqual(fourth.status_code, 429)
        self.assertEqual(len(sent), 3)
        self.assertEqual(old.status_code, 400)

    def test_email_input_is_validated_and_accounts_are_separate(self):
        sent = []
        with self.email_settings():
            bad = self.alice.post("/api/account/email", json={"email": "not-an-email"})
            self.request_code(self.alice, sent)
            # Bob cannot use Alice's code.
            bob_try = self.bob.post("/api/account/email/verify", json={"code": sent[0]})
            malformed = self.alice.post("/api/account/email/verify", json={"code": "12ab"})
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bob_try.status_code, 400)
        self.assertEqual(malformed.status_code, 400)

    def test_failed_delivery_stores_no_code(self):
        def fail(to, code):
            raise email_service.EmailDeliveryFailed()

        with self.email_settings(), patch.object(email_service, "send_verification_email", fail):
            response = self.alice.post("/api/account/email", json={"email": "a@example.com"})
        self.assertEqual(response.status_code, 502)
        self.assertEqual(sql("SELECT COUNT(*) FROM email_verification_codes")[0][0], 0)

    def test_sign_up_requires_an_email_and_features_wait_for_verification(self):
        sent = []
        client = TestClient(main.app, base_url="http://localhost")
        details = {"name": "Carmen", "username": "carmen", "password": "correct horse"}
        with self.email_settings(), patch.object(email_service, "send_verification_email",
                                                 lambda to, code: sent.append((to, code))):
            self.assertTrue(client.get("/api/auth/config").json()["email_verification_required"])
            missing = client.post("/api/auth/register", json=details)
            created = client.post("/api/auth/register", json={**details, "email": "carmen.family@example.com"})
            blocked = [client.get("/api/flashcards").status_code, client.get("/api/pets").status_code,
                       client.get("/api/words/next").status_code,
                       client.post("/api/flashcards", json={"word_id": self.words[0], "drawing": PNG}).status_code]
            me_before = client.get("/api/auth/me").json()
            verified = client.post("/api/account/email/verify", json={"code": sent[0][1]})
            unblocked = client.get("/api/flashcards").status_code
            me_after = client.get("/api/auth/me").json()
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(created.status_code, 201)
        self.assertTrue(created.json()["email_code"]["sent"])
        self.assertEqual(sent[0][0], "carmen.family@example.com")
        self.assertEqual(blocked, [403, 403, 403, 403])
        self.assertEqual((me_before["email_required"], me_before["email_verified"]), (True, False))
        self.assertEqual(verified.status_code, 200)
        self.assertEqual(unblocked, 200)
        self.assertTrue(me_after["email_verified"])

    def test_existing_accounts_upgrade_by_verifying_after_login(self):
        # Alice was created before verification was turned on.
        self.make_card(self.alice, 0)
        sent = []
        with self.email_settings(), patch.object(email_service, "send_verification_email",
                                                 lambda to, code: sent.append(code)):
            login = self.alice.post("/api/auth/login", json={"username": "alice", "password": "correct horse"})
            blocked = self.alice.get("/api/flashcards").status_code
            self.alice.post("/api/account/email", json={"email": "alice@example.com"})
            self.alice.post("/api/account/email/verify", json={"code": sent[0]})
            cards = self.alice.get("/api/flashcards")
        self.assertEqual(login.status_code, 200)
        self.assertFalse(login.json()["email_verified"])
        self.assertEqual(blocked, 403)
        self.assertEqual(cards.status_code, 200)
        self.assertEqual(len(cards.json()), 1, "existing cards are kept")

    def test_turned_on_without_smtp_does_not_lock_anyone_out(self):
        with self.email_settings(SMTP_HOST=""):
            self.assertFalse(self.alice.get("/api/auth/config").json()["email_verification_required"])
            self.assertEqual(self.alice.get("/api/flashcards").status_code, 200)

    def test_real_smtp_delivery_to_local_mailpit(self):
        try:
            urlopen(f"{MAILPIT_API}/messages", timeout=2).close()
        except OSError:
            self.skipTest("Mailpit is not running")
        urlopen_delete = __import__("urllib.request").request.Request(f"{MAILPIT_API}/messages", method="DELETE")
        urlopen(urlopen_delete, timeout=5).close()
        with self.email_settings():
            response = self.alice.post("/api/account/email", json={"email": "family@example.com"})
            self.assertEqual(response.status_code, 200, response.text)
            for _ in range(20):
                messages = json.load(urlopen(f"{MAILPIT_API}/messages", timeout=5))["messages"]
                if messages:
                    break
                time.sleep(0.25)
            self.assertEqual(len(messages), 1)
            message = json.load(urlopen(f"{MAILPIT_API}/message/{messages[0]['ID']}", timeout=5))
            self.assertEqual(message["To"][0]["Address"], "family@example.com")
            code = re.search(r"code is (\d{6})", message["Text"]).group(1)
            verified = self.alice.post("/api/account/email/verify", json={"code": code})
        self.assertEqual(verified.status_code, 200)
        self.assertTrue(verified.json()["verified"])


if __name__ == "__main__":
    unittest.main()
