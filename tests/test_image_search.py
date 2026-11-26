import io
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit
from api.image_search import fetch_images, ImageSearchError, allowed_url


class ImageSearchTests(unittest.TestCase):
    def test_documented_image_hosts_and_parameters(self):
        import json
        hits = [
            {"id": i, "pageURL": "https://pixabay.com/photos/clock-1/",
             "webformatURL": url}
            for i, url in enumerate(["https://cdn.pixabay.com/photo/clock.jpg",
                                     "https://pixabay.com/get/clock.jpg",
                                     "https://evil.example/clock.jpg"])
        ]
        with patch("api.image_search.urlopen", return_value=io.BytesIO(json.dumps({"hits": hits}).encode())) as call:
            result = fetch_images("clock & watch", "secret")
        self.assertEqual(len(result["images"]), 2)
        query = parse_qs(urlsplit(call.call_args.args[0].full_url).query)
        self.assertEqual(query["q"], ["clock & watch"])
        self.assertEqual(query["safesearch"], ["true"])
        self.assertEqual(query["image_type"], ["all"])

    def test_key_is_not_exposed_in_error_or_logs(self):
        error = HTTPError("https://pixabay.com/api/?key=secret", 403, "", {},
                          io.BytesIO(b"Invalid API key: secret"))
        with patch("api.image_search.urlopen", side_effect=error):
            with self.assertLogs("mangos-api") as logs:
                with self.assertRaises(ImageSearchError) as caught:
                    fetch_images("clock", "secret")
        self.assertEqual(caught.exception.status, 503)
        self.assertNotIn("secret", caught.exception.message + str(logs.output))

    def test_html_rejection_distinct_from_key_error(self):
        error = HTTPError("https://pixabay.com/api/", 403, "", {},
                          io.BytesIO(b"<!DOCTYPE html><html>Access denied</html>"))
        with patch("api.image_search.urlopen", side_effect=error):
            with self.assertLogs("mangos-api") as logs:
                with self.assertRaises(ImageSearchError) as caught:
                    fetch_images("clock", "secret")
        self.assertEqual(caught.exception.status, 502)
        self.assertIn("html-block", str(logs.output))

    def test_rate_limit_and_invalid_urls(self):
        error = HTTPError("https://pixabay.com/api/", 429, "", {}, io.BytesIO(b"rate limit"))
        with patch("api.image_search.urlopen", side_effect=error):
            with self.assertLogs("mangos-api"):
                with self.assertRaises(ImageSearchError) as caught:
                    fetch_images("clock", "secret")
        self.assertEqual(caught.exception.status, 429)
        for url in ["http://pixabay.com/a", "https://pixabay.com.evil.example/a",
                    "https://user:pass@pixabay.com/a", "https://pixabay.com:999/a"]:
            self.assertFalse(allowed_url(url, {"pixabay.com"}))

    def test_picture_type_is_passed_and_validated(self):
        with patch("api.image_search.urlopen", return_value=io.BytesIO(b'{"hits": []}')) as call:
            fetch_images("running", "secret", "illustration")
        query = parse_qs(urlsplit(call.call_args.args[0].full_url).query)
        self.assertEqual(query["image_type"], ["illustration"])
        with patch("api.image_search.urlopen") as call:
            with self.assertRaises(ImageSearchError) as caught:
                fetch_images("running", "secret", "anything&key=x")
        self.assertEqual(caught.exception.status, 400)
        call.assert_not_called()

    def test_no_results(self):
        with patch("api.image_search.urlopen", return_value=io.BytesIO(b'{"hits": []}')):
            self.assertEqual(fetch_images("clock", "secret"), {"images": []})


if __name__ == "__main__":
    unittest.main()
