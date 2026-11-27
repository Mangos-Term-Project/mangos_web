"""Build the LOCAL database: all tables (api/db/schema.sql) and every word (api/db/words.json).

Start the local services first, from the repository root:

    docker compose -f docker-compose.local.yml up -d
    python api/db/setup_local.py

Safe to run again at any time: it creates what is missing and brings the
words up to date. It refuses to run unless DATABASE_URL points at this
computer, so it can never touch Supabase.
"""
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sync_words import ROOT, is_local, sync  # noqa: E402

SCHEMA = ROOT / "api" / "db" / "schema.sql"
LOCAL_URL = "postgresql://mangos:mangos_local_only@127.0.0.1:55432/mangos"


def main() -> None:
    load_dotenv(ROOT / ".env")
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise SystemExit(f"Set DATABASE_URL in the repository-root .env file, for example:\n  DATABASE_URL={LOCAL_URL}")
    if not is_local(url):
        raise SystemExit(f"Refusing to run: DATABASE_URL points at {urlsplit(url).hostname}, not this computer.\n"
                         f"For local work, set DATABASE_URL={LOCAL_URL} in .env")
    try:
        connection = psycopg2.connect(url, connect_timeout=5)
    except psycopg2.OperationalError:
        raise SystemExit("Could not reach the local database. Is Docker running?\n"
                         "  docker compose -f docker-compose.local.yml up -d") from None
    with connection, connection.cursor() as cursor:
        cursor.execute(SCHEMA.read_text(encoding="utf-8"))
    connection.close()
    print("tables ready")
    sync(url, apply=True, quiet=True)
    print("local database is ready")


if __name__ == "__main__":
    main()
