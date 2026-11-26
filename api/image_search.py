"""Pixabay reference search. Credentials and provider diagnostics stay server-side."""
import json
import logging
import ssl

import certifi
from http.client import HTTPException as HTTPProtocolError
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
        tls_context = ssl.create_default_context(cafile=certifi.where())
        with urlopen(request, timeout=8, context=tls_context) as response:
            payload = json.load(response)
    except HTTPError as error:
        try:
            body = error.read(2048).decode("utf-8", errors="replace").strip()
        except (OSError, HTTPProtocolError):
            body = ""
        # Pixabay's request URL contains the key, so redact it before returning
        # or logging the response body. Keep diagnostics bounded and one-line.
        api_key = str(params.get("key") or "")
        encoded_key = urlencode({"key": api_key}).partition("=")[2]
        for secret in (api_key, encoded_key):
            if secret:
                body = body.replace(secret, "[redacted]")
        body = " ".join((body or str(error.reason or "No response body")).split())[:2048]
        status = error.code if 400 <= error.code <= 599 else 502
        message = f"Pixabay returned HTTP {status}: {body}"
        logger.warning("%s", message)
        raise ImageSearchError(status, message) from None
    except (URLError, TimeoutError, OSError, HTTPProtocolError, ValueError) as error:
        logger.warning("Pixabay request failed (%s)", type(error).__name__)
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
    if not isinstance(tags, str):
        tags = ""
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
