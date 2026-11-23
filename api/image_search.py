"""Pixabay reference search. Credentials and provider diagnostics stay server-side."""
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

logger = logging.getLogger("mangos-api")


class ImageSearchError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message


def allowed_url(value, hosts):
    try:
        parsed = urlsplit(value)
        return parsed.scheme == "https" and parsed.hostname in hosts and not parsed.username and not parsed.password and parsed.port in (None, 443)
    except (ValueError, TypeError):
        return False


def fetch_images(query, key):
    params = urlencode({"key": key, "q": query, "safesearch": "true",
                        "image_type": "all", "per_page": 12, "lang": "en"})
    request = Request("https://pixabay.com/api/?" + params, headers={
        "User-Agent": "MangosLearningEnglish/1.0",
        "Accept": "application/json",
    })
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.load(response)
    except HTTPError as error:
        # Classify without logging the response, request URL, key, or query.
        body = error.read(2048).decode(errors="replace").lower()
        kind = "invalid-key" if "invalid" in body and "key" in body else (
            "html-block" if "<html" in body or "<!doctype" in body else "provider-error")
        logger.warning("Pixabay HTTP %s (%s)", error.code, kind)
        if error.code == 429:
            raise ImageSearchError(429, "Picture search has reached its limit. Please try again shortly.") from None
        if kind == "invalid-key":
            raise ImageSearchError(503, "Picture search needs an API key update. Please tell your teacher.") from None
        if error.code == 403:
            raise ImageSearchError(502, "The picture provider refused the request. Please try again later.") from None
        raise ImageSearchError(502, "The picture provider could not complete this search.") from None
    except (URLError, TimeoutError, ValueError):
        raise ImageSearchError(502, "Could not reach the picture provider. Please try again.") from None

    if not isinstance(payload, dict) or not isinstance(payload.get("hits"), list):
        raise ImageSearchError(502, "The picture provider sent an unexpected response.")
    images = []
    for hit in payload["hits"]:
        if not isinstance(hit, dict):
            continue
        thumbnail = hit.get("webformatURL", "")
        source = hit.get("pageURL", "")
        if not allowed_url(thumbnail, {"cdn.pixabay.com", "pixabay.com"}):
            continue
        if not allowed_url(source, {"pixabay.com"}):
            continue
        images.append({"id": hit.get("id"), "thumbnail": thumbnail,
                       "source": source, "description": hit.get("tags") or "Reference picture"})
    return {"images": images}
