"""Offline tests: child-safety filter, hand-picked pictures, typed vocabulary words."""
import io
import json
import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = ""
os.environ["REDIS_URL"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from api import image_search, main  # noqa: E402
from api.content_filter import is_blocked  # noqa: E402
from api.word_pictures import WORD_PICTURES  # noqa: E402


def hit(image_id, tags):
    return {"id": image_id, "tags": tags, "pageURL": f"https://pixabay.com/illustrations/x-{image_id}/",
            "webformatURL": f"https://cdn.pixabay.com/photo/{image_id}.png"}


class FakeStore:
    def __init__(self, sessions):
        self.values = {main.session_key(t): u for t, u in sessions.items()}

    def get(self, key):
        return self.values.get(key)

    def set(self, key, value, ex=None):
        self.values[key] = value

    def pipeline(self):
        store = self

        class Pipe:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def incr(self, key):
                store.values[key] = int(store.values.get(key, 0)) + 1
                return self

            def expire(self, *args, **kwargs):
                return self

            def execute(self):
                return [store.values[k] for k in store.values if k.startswith("mangos:images:rate:")][-1:] + [True]

        return Pipe()


class ContentFilterTests(unittest.TestCase):
    def test_rude_scary_and_adult_words_are_blocked(self):
        for text in ["shit happens", "Shit, Happens, Funny", "horror skull", "gun", "sexy girl", "dead body", "beer party"]:
            self.assertTrue(is_blocked(text), text)

    def test_ordinary_vocabulary_is_not_blocked(self):
        for text in ["happen", "green traffic light", "dry leaves", "dead", "war", "party", "close friends",
                     "assassin bug", "skeleton anatomy", "archery shooting target"]:
            self.assertFalse(is_blocked(text), text)

    def test_search_results_with_blocked_tags_are_dropped(self):
        hits = [hit(1, "surprise, gift"), hit(2, "shit happens, quote"), hit(3, "skull, halloween"), hit(4, "party, balloons")]
        with patch("api.image_search.urlopen", return_value=io.BytesIO(json.dumps({"hits": hits}).encode())):
            result = image_search.fetch_images("surprise", "secret")
        self.assertEqual([image["id"] for image in result["images"]], [1, 4])

    def test_hand_picked_pictures_are_not_dropped_by_the_word_filter(self):
        # A person checked these already; an archery target is tagged "shooting, weapon".
        archery = hit(9, "arrows, target, shooting, weapon, archery, center")
        with patch("api.image_search.urlopen", return_value=io.BytesIO(json.dumps({"hits": [archery]}).encode())):
            self.assertEqual(image_search.fetch_image_by_id(9, "secret")["id"], 9)
        with patch("api.image_search.urlopen", return_value=io.BytesIO(json.dumps({"hits": [archery]}).encode())):
            self.assertEqual(image_search.fetch_images("target", "secret")["images"], [], "open searches still filter")


class PickedPictureTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app, base_url="http://localhost")
        self.client.cookies.set(main.SESSION_COOKIE, "token")
        self.patches = [patch.object(main, "session_store", FakeStore({"token": "user-1"})),
                        patch.dict(os.environ, {"PIXABAY_API_KEY": "secret"})]
        for active in self.patches:
            active.start()

    def tearDown(self):
        for active in self.patches:
            active.stop()

    def fake_by_id(self, image_id, key):
        return {"id": image_id, "thumbnail": f"https://cdn.pixabay.com/photo/{image_id}.png",
                "source": "https://pixabay.com/x/", "description": "picked"}

    def test_every_picked_list_has_unique_ids(self):
        for part, words in WORD_PICTURES.items():
            for word, value in words.items():
                senses = value if value and isinstance(value[0], list) else [value]
                ids = [i for sense in senses for i in sense]
                self.assertTrue(1 <= len(ids) <= 12, word)
                self.assertEqual(len(ids), len(set(ids)), word)
                self.assertTrue(all(isinstance(i, int) and i > 0 for i in ids), word)

    def test_word_endpoint_returns_the_picked_pictures(self):
        with patch.object(main, "fetch_image_by_id", side_effect=self.fake_by_id) as by_id:
            response = self.client.get("/api/images/word", params={"word": "Go"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["picked"])
        self.assertEqual([i["id"] for i in response.json()["images"]], WORD_PICTURES["verb"]["go"])
        self.assertEqual([g["part"] for g in response.json()["groups"]], ["verb"])
        self.assertEqual(by_id.call_count, len(WORD_PICTURES["verb"]["go"]))

    def test_two_part_words_keep_separate_pictures_per_part(self):
        fake = {"noun": {"work": [11, 12]}, "verb": {"work": [21, 22]}, "adjective": {}}
        with patch.object(main, "WORD_PICTURES", {"work": [("noun", 0, [11, 12]), ("verb", 0, [21, 22])]}),                 patch.object(main, "fetch_image_by_id", side_effect=self.fake_by_id):
            groups = self.client.get("/api/images/word", params={"word": "work"}).json()["groups"]
        self.assertEqual([(g["part"], [i["id"] for i in g["images"]]) for g in groups],
                         [("noun", [11, 12]), ("verb", [21, 22])])
        self.assertTrue(fake)

    def test_pictures_for_one_meaning_are_labeled_with_that_meaning(self):
        with patch.object(main, "fetch_image_by_id", side_effect=self.fake_by_id):
            groups = self.client.get("/api/images/word", params={"word": "light"}).json()["groups"]
        self.assertEqual([(g["part"], g["sense"]) for g in groups], [("adjective", 0), ("adjective", 1)])

    def test_word_without_picks_returns_nothing(self):
        response = self.client.get("/api/images/word", params={"word": "elephant"})
        self.assertEqual(response.json(), {"images": [], "groups": [], "picked": False})

    def test_typing_a_vocabulary_word_or_its_form_shows_picked_pictures(self):
        with patch.object(main, "fetch_image_by_id", side_effect=self.fake_by_id), \
                patch.object(main, "fetch_images") as open_search:
            for typed in ["happen", "happens", "Happened", "happening", "lives", "living"]:
                response = self.client.get("/api/images/search", params={"q": typed})
                self.assertEqual(response.status_code, 200, typed)
                self.assertTrue(response.json()["picked"], typed)
        open_search.assert_not_called()

    def test_typing_a_vocabulary_word_searches_its_checked_phrase(self):
        with patch.object(main, "WORD_PICTURES", {}), patch.object(main, "PICKED_FOR_TYPED", {}),                 patch.object(main, "fetch_images", return_value={"images": []}) as open_search:
            self.client.get("/api/images/search", params={"q": "Looking"})
            self.client.get("/api/images/search", params={"q": "elephant"})
        self.assertEqual(open_search.call_args_list[0].args[:3], ("binoculars", "secret", "illustration"))
        self.assertEqual(open_search.call_args_list[1].args[:3], ("elephant", "secret", "all"))

    def test_phrase_table_matches_the_hints(self):
        import re
        from pathlib import Path
        from api.word_phrases import WORD_PHRASES
        text = (Path(__file__).resolve().parents[1] / "src/data/wordHints.js").read_text(encoding="utf-8")
        for word, (phrase, part) in WORD_PHRASES.items():
            self.assertIn(f"searchPhrase: {phrase!r}".replace('"', "'") if "'" not in phrase else word, text, word)
        self.assertEqual(len(WORD_PHRASES), 292)

    def test_blocked_searches_are_refused(self):
        with patch.object(main, "fetch_images") as open_search:
            response = self.client.get("/api/images/search", params={"q": "shit happens"})
        self.assertEqual(response.status_code, 400)
        open_search.assert_not_called()

    def test_word_endpoint_needs_login(self):
        anonymous = TestClient(main.app, base_url="http://localhost")
        self.assertEqual(anonymous.get("/api/images/word", params={"word": "go"}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
