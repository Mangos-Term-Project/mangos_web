"""Check how many Pixabay pictures each suggested search phrase finds.

Run by a teammate who has the Pixabay key, from the repository root:

    PIXABAY_API_KEY=... python api/tools/check_hint_searches.py --parts verb,adjective

It sends at most one request per second (Pixabay allows 100 per minute and
asks for real, not mass, use), keeps results for 24 hours in
api/tools/.hint_search_cache.json as Pixabay requires, and never prints the
key. It counts results only: a phrase with many results can still show
pictures that do not fit the word, so look at the weakest ones in the app.
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
HINTS = ROOT / "src" / "data" / "wordHints.js"
CACHE = Path(__file__).resolve().parent / ".hint_search_cache.json"
CACHE_SECONDS = 24 * 60 * 60
LINE = re.compile(r"^\t\t'?([a-z]+)'?: \{ definition: '(?:[^'\\]|\\.)*', searchPhrase: '((?:[^'\\]|\\.)*)' \},$")


def read_hints():
    hints, part = [], None
    for line in HINTS.read_text(encoding="utf-8").splitlines():
        header = re.match(r"^\t(noun|verb|adjective): \{$", line)
        if header:
            part = header.group(1)
            continue
        match = LINE.match(line)
        if part and match:
            hints.append((part, match.group(1), match.group(2).replace("\\'", "'")))
    return hints


def load_cache():
    try:
        data = json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    now = time.time()
    return {key: value for key, value in data.items() if now - value["at"] < CACHE_SECONDS}


def count_results(key, phrase, image_type):
    params = urlencode({"key": key, "q": phrase, "image_type": image_type, "safesearch": "true", "per_page": 3})
    request = Request("https://pixabay.com/api/?" + params, headers={"User-Agent": "MangosLearningEnglish/1.0 (hint check)"})
    with urlopen(request, timeout=10) as response:
        return int(json.load(response).get("totalHits", 0))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--parts", default="noun,verb,adjective", help="comma-separated parts of speech to check")
    parser.add_argument("--weak", type=int, default=20, help="report phrases with fewer results than this")
    args = parser.parse_args()

    key = os.getenv("PIXABAY_API_KEY", "").strip()
    if not key:
        sys.exit("Set PIXABAY_API_KEY in this terminal first (it is not printed).")
    parts = {part.strip() for part in args.parts.split(",") if part.strip()}
    cache = load_cache()
    weak = []
    hints = [hint for hint in read_hints() if hint[0] in parts]
    for index, (part, word, phrase) in enumerate(hints, 1):
        # Same default as the app: verbs and adjectives search illustrations.
        image_type = "all" if part == "noun" else "illustration"
        cache_key = f"{image_type}:{phrase}"
        if cache_key not in cache:
            try:
                cache[cache_key] = {"hits": count_results(key, phrase, image_type), "at": time.time()}
            except HTTPError as error:
                sys.exit(f"Pixabay returned HTTP {error.code}; stopping. Results so far are cached.")
            except (URLError, TimeoutError, ValueError):
                sys.exit("Could not reach Pixabay; stopping. Results so far are cached.")
            finally:
                CACHE.write_text(json.dumps(cache), encoding="utf-8")
            time.sleep(1)
        hits = cache[cache_key]["hits"]
        if hits < args.weak:
            weak.append((hits, part, word, phrase, image_type))
        print(f"[{index}/{len(hints)}] {part:9} {word:12} {phrase!r:28} {image_type:12} {hits}")

    print(f"\n{len(weak)} of {len(hints)} phrases found fewer than {args.weak} pictures:")
    for hits, part, word, phrase, image_type in sorted(weak):
        print(f"  {hits:5}  {part}.{word}: {phrase!r} ({image_type})")


if __name__ == "__main__":
    main()
