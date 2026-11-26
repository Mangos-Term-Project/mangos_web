"""Pixabay reference search. Credentials and provider diagnostics stay server-side."""
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

try:
    from .content_filter import is_blocked
except ImportError:
    from content_filter import is_blocked

logger = logging.getLogger("mangos-api")

# Pixabay's documented image_type values.
IMAGE_TYPES = ("all", "photo", "illustration", "vector")
# Languages Mangos searches in (Pixabay's `lang` parameter: the search words' language).
SEARCH_LANGUAGES = ("en", "es")


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


def _request(params):
    request = Request("https://pixabay.com/api/?" + urlencode(params), headers={
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
    return payload["hits"]


def _image(hit, filter_tags=True):
    """A result in the app's shape, or None if its URLs (or, when filtering, its tags) are not acceptable."""
    if not isinstance(hit, dict):
        return None
    thumbnail = hit.get("webformatURL", "")
    source = hit.get("pageURL", "")
    tags = hit.get("tags") or ""
    if not allowed_url(thumbnail, {"cdn.pixabay.com", "pixabay.com"}) or not allowed_url(source, {"pixabay.com"}):
        return None
    if filter_tags and is_blocked(tags):
        return None  # child-safety filter for open searches (see content_filter.py)
    return {"id": hit.get("id"), "thumbnail": thumbnail, "source": source, "description": tags or "Reference picture"}


def fetch_images(query, key, image_type="all", lang="en"):
    if image_type not in IMAGE_TYPES:
        raise ImageSearchError(400, "Choose a valid picture type.")
    if lang not in SEARCH_LANGUAGES:
        raise ImageSearchError(400, "Choose a valid search language.")
    # Ask for extra results so the safety filter can drop some and still leave about 12.
    hits = _request({"key": key, "q": query, "safesearch": "true", "image_type": image_type,
                     "per_page": 20, "lang": lang})
    images = [image for image in map(_image, hits) if image]
    return {"images": images[:12]}


def fetch_image_by_id(image_id, key):
    """One hand-picked picture by its Pixabay ID, or None if it is gone.

    Hand-picked pictures were already checked by a person, so the word filter
    is not applied: tags such as "shooting" on an archery target would
    otherwise remove a good picture. Pixabay's safesearch still applies.
    """
    hits = _request({"key": key, "id": int(image_id), "safesearch": "true"})
    return _image(hits[0], filter_tags=False) if hits else None
