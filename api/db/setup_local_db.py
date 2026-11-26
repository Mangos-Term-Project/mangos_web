"""Build the LOCAL test database: inferred existing tables, new migrations, and words.

Usage (from the repository root, with docker-compose.local.yml running):

    python api/db/setup_local_db.py                       # database "mangos"
    python api/db/setup_local_db.py --database mangos_test

It refuses to connect anywhere except this computer, so it cannot touch
Supabase or any shared database even if DATABASE_URL points there.
"""
import argparse
import re
from pathlib import Path
from urllib.parse import urlsplit

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
LOCAL_SCHEMA = ROOT / "api" / "db" / "local_schema_inferred.sql"
MIGRATIONS = sorted((ROOT / "api" / "migrations").glob("*.sql"))
WORDS_FILE = ROOT / "src" / "flashcardWords.js"
LOCAL_SERVER_URL = "postgresql://mangos:mangos_local_only@127.0.0.1:55432/{database}"
LOCAL_HOSTS = {"127.0.0.1", "localhost"}


def local_url(database: str) -> str:
    if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", database):
        raise SystemExit("Database name must be lowercase letters, digits or underscores.")
    url = LOCAL_SERVER_URL.format(database=database)
    if urlsplit(url).hostname not in LOCAL_HOSTS:
        raise SystemExit("Refusing to run: this script only works on a local database.")
    return url


def vocabulary_words() -> list[str]:
    text = WORDS_FILE.read_text(encoding="utf-8")
    blocks = re.findall(r"`([^`]*)`", text)
    seen: dict[str, None] = {}
    for block in blocks:
        for word in block.split():
            seen.setdefault(word.lower(), None)
    return list(seen)


def ensure_database(database: str) -> None:
    connection = psycopg2.connect(local_url("mangos"))
    connection.autocommit = True
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (database,))
        if cursor.fetchone() is None:
            cursor.execute(f'CREATE DATABASE "{database}"')
    connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database", default="mangos")
    args = parser.parse_args()

    ensure_database(args.database)
    connection = psycopg2.connect(local_url(args.database))
    connection.autocommit = True
    with connection.cursor() as cursor:
        cursor.execute(LOCAL_SCHEMA.read_text(encoding="utf-8"))
        for migration in MIGRATIONS:
            cursor.execute(migration.read_text(encoding="utf-8"))
            print(f"applied {migration.name}")
        words = vocabulary_words()
        cursor.executemany("INSERT INTO word (word) VALUES (%s) ON CONFLICT (word) DO NOTHING", [(w,) for w in words])
        cursor.execute("SELECT COUNT(*) FROM word")
        print(f"words in local database: {cursor.fetchone()[0]} (distinct words in the list: {len(words)})")
    connection.close()
    print(f"local database '{args.database}' is ready")


if __name__ == "__main__":
    main()
