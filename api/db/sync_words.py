"""Copy the vocabulary in api/db/words.json into a database's `word` table.

api/db/words.json is the master copy of every word, definition, suggested
search and hand-picked picture. Change words there, in a pull request, and
then run this script so the database matches the file.

    python api/db/sync_words.py                    # show what would change (changes nothing)
    python api/db/sync_words.py --apply            # change a local database
    python api/db/sync_words.py --apply --shared   # change a shared database such as Supabase

It uses DATABASE_URL from the repository-root .env file (or the environment).
Rows are matched by word_id, so flash cards that point at a word keep working.
A word that is in the database but not in the file is reported, never deleted:
deleting a word would also delete every flash card made with it.
"""
import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import Json, RealDictCursor

ROOT = Path(__file__).resolve().parents[2]
WORDS_FILE = ROOT / "api" / "db" / "words.json"
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}
FIELDS = ("word", "part_of_speech", "senses")


def is_local(url: str) -> bool:
    return urlsplit(url).hostname in LOCAL_HOSTS


def load_words() -> list[dict]:
    words = json.loads(WORDS_FILE.read_text(encoding="utf-8"))
    seen = set()
    for row in words:
        key = (row["word"].lower(), row["part_of_speech"])
        if key in seen:
            raise SystemExit(f"words.json lists {key[0]} ({key[1]}) twice.")
        seen.add(key)
        if not row.get("word_id"):
            raise SystemExit(f"words.json: {row['word']} has no word_id.")
        for sense in row["senses"]:
            missing = {"definition", "search_phrase", "more_searches", "pixabay_image_ids"} - sense.keys()
            if missing:
                raise SystemExit(f"words.json: {row['word']} is missing {', '.join(sorted(missing))}.")
    return words


def plan(cursor, words: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    cursor.execute("SELECT word_id::text, word, part_of_speech, senses FROM word")
    current = {row["word_id"]: row for row in cursor.fetchall()}
    inserts = [row for row in words if row["word_id"] not in current]
    updates = [row for row in words if row["word_id"] in current
               and any(current[row["word_id"]][f] != row[f] for f in FIELDS)]
    file_ids = {row["word_id"] for row in words}
    extra = [row for word_id, row in current.items() if word_id not in file_ids]
    return inserts, updates, extra


def sync(url: str, apply: bool, quiet: bool = False) -> int:
    words = load_words()
    with psycopg2.connect(url, cursor_factory=RealDictCursor) as connection, connection.cursor() as cursor:
        inserts, updates, extra = plan(cursor, words)
        if not quiet:
            for row in inserts:
                print(f"  add     {row['word']} ({row['part_of_speech']})")
            for row in updates:
                print(f"  update  {row['word']} ({row['part_of_speech']})")
            for row in extra:
                print(f"  only in the database (left alone): {row['word']} ({row['part_of_speech']})")
        if apply:
            for row in inserts:
                cursor.execute("INSERT INTO word (word_id, word, part_of_speech, senses) VALUES (%s, %s, %s, %s)",
                               (row["word_id"], row["word"], row["part_of_speech"], Json(row["senses"])))
            for row in updates:
                cursor.execute("UPDATE word SET word = %s, part_of_speech = %s, senses = %s WHERE word_id = %s",
                               (row["word"], row["part_of_speech"], Json(row["senses"]), row["word_id"]))
        # Leaving the "with" block commits; a dry run changes nothing.
    verb = "added" if apply else "to add"
    print(f"{len(inserts)} {verb}, {len(updates)} {'updated' if apply else 'to update'}, "
          f"{len(extra)} only in the database, {len(words)} words in words.json")
    return len(inserts) + len(updates)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="make the changes (default: only show them)")
    parser.add_argument("--shared", action="store_true", help="allow changing a database that is not on this computer")
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise SystemExit("Set DATABASE_URL in the repository-root .env file.")
    host = urlsplit(url).hostname
    if args.apply and not is_local(url) and not args.shared:
        raise SystemExit(f"DATABASE_URL points at {host}, which is not this computer.\n"
                         "To change that shared database, run again with --apply --shared.")
    print(f"{'Updating' if args.apply else 'Comparing with'} the database at {host}")
    sync(url, args.apply)
    if not args.apply:
        print("Nothing was changed. Add --apply to make these changes.")


if __name__ == "__main__":
    sys.exit(main())
