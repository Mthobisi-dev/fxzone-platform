"""Rebuild the integration-test database from the schema and migrations.

This replaces the shell-only runner so the same test command works on Windows,
Linux, and macOS when ``psql`` and PostgreSQL are available.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def run(psql: str, database_url: str, *args: str) -> None:
    subprocess.run(
        [psql, database_url, "-q", "-v", "ON_ERROR_STOP=1", *args],
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url", nargs="?", default="postgresql://postgres:postgres@localhost:5432")
    parser.add_argument("database", nargs="?", default="fxzone_test")
    args = parser.parse_args()

    psql = shutil.which("psql")
    if not psql:
        print("psql is required to prepare the backend integration-test database.", file=sys.stderr)
        return 2

    base_url = args.base_url.rstrip("/")
    database_url = f"{base_url}/{args.database}"
    run(
        psql,
        f"{base_url}/postgres",
        "-c",
        f"DROP DATABASE IF EXISTS {args.database} WITH (FORCE)",
        "-c",
        f"CREATE DATABASE {args.database}",
    )

    for sql_file in (
        HERE / "00_supabase_stub.sql",
        ROOT / "supabase_schema.sql",
        *sorted((ROOT / "supabase" / "migrations").glob("00[1-6]_*.sql")),
        HERE / "99_grants.sql",
    ):
        run(psql, database_url, "-f", str(sql_file))
    print(f"database {args.database} ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
