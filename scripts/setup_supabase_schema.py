"""
FxZone Supabase Schema Setup Script
====================================
Connects to your Supabase PostgreSQL database and creates the full
FxZone schema (tables, indexes, enums) and seeds initial demo data.

Usage:
    python scripts/setup_supabase_schema.py

Requires:
    pip install httpx
"""
import sys
import os
import json

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import httpx

# -- Configuration -----------------------------------------------------------
SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    "https://jimbcgbhjkahnljpijqy.supabase.co"
)
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    ""
)

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def read_sql_file(path: str) -> str:
    """Read a SQL file and return its contents."""
    abs_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        path
    )
    if not os.path.exists(abs_path):
        print(f"  [ERROR] SQL file not found: {abs_path}")
        sys.exit(1)
    with open(abs_path, "r", encoding="utf-8") as f:
        return f.read()


def split_sql_statements(sql_content: str) -> list:
    """Split SQL content into individual executable statements."""
    statements = []
    current = []
    in_function = False

    for line in sql_content.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        if "$$" in stripped:
            in_function = not in_function
        current.append(line)
        if not in_function and stripped.endswith(";"):
            stmt = "\n".join(current).strip()
            if stmt and stmt != ";":
                statements.append(stmt)
            current = []

    if current:
        stmt = "\n".join(current).strip()
        if stmt and stmt != ";":
            statements.append(stmt)

    return statements


def test_connection() -> bool:
    """Test the Supabase connection by querying the REST endpoint."""
    print("\n[*] Testing Supabase connection...")
    try:
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            timeout=10.0,
        )
        if resp.status_code == 200:
            print(f"  [OK] Connected to Supabase: {SUPABASE_URL}")
            # Try to list existing tables
            definitions = resp.json() if resp.text else {}
            if isinstance(definitions, dict) and "definitions" in definitions:
                tables = list(definitions["definitions"].keys())
                print(f"  [OK] Found {len(tables)} existing tables/views")
            return True
        else:
            print(f"  [FAIL] HTTP {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"  [FAIL] Connection error: {e}")
        return False


def execute_sql_batch(sql_content: str, label: str) -> tuple:
    """Execute full SQL content as a single batch via Supabase SQL API."""
    print(f"\n[*] Executing {label} via Supabase SQL API...")

    # Try the management API endpoint for SQL execution
    # This is the standard Supabase way to run arbitrary SQL
    try:
        resp = httpx.post(
            f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
            headers=HEADERS,
            json={"query": sql_content},
            timeout=60.0,
        )
        if resp.status_code in (200, 204):
            print(f"  [OK] {label} executed successfully via RPC")
            return (True, "")
        else:
            return (False, resp.text[:300])
    except Exception as e:
        return (False, str(e))


def main():
    print("=" * 60)
    print("  FxZone -- Supabase Schema Setup")
    print("=" * 60)
    print(f"\n  Supabase URL:  {SUPABASE_URL}")
    print(f"  Service Key:   {SUPABASE_SERVICE_ROLE_KEY[:20]}...")

    # Test connection
    connected = test_connection()

    # Read SQL files
    print("\n[*] Reading schema files...")
    schema_sql = read_sql_file("database/postgresql/001_create_tables.sql")
    seed_sql = read_sql_file("database/postgresql/002_seed_data.sql")

    schema_stmts = split_sql_statements(schema_sql)
    seed_stmts = split_sql_statements(seed_sql)

    print(f"  Schema: {len(schema_stmts)} statements")
    print(f"  Seed:   {len(seed_stmts)} statements")

    if not connected:
        print("\n" + "=" * 60)
        print("  [!] Could not connect to Supabase REST API.")
        print("  This is OK -- the keys and URL are configured.")
        print()
        print("  NEXT STEPS: Deploy the schema manually:")
        print("  1. Go to https://supabase.com/dashboard")
        print("  2. Open your project")
        print("  3. Navigate to SQL Editor")
        print("  4. Paste and run these files in order:")
        print(f"     -> database/postgresql/001_create_tables.sql")
        print(f"     -> database/postgresql/002_seed_data.sql")
        print("=" * 60)

        # Still output the full SQL for easy copy-paste
        output_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "database", "supabase_full_schema.sql"
        )
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("-- FxZone Full Schema for Supabase\n")
            f.write("-- Execute this in Supabase SQL Editor\n")
            f.write("-- Generated by setup_supabase_schema.py\n\n")
            f.write("-- =============================================\n")
            f.write("-- PART 1: CREATE TABLES\n")
            f.write("-- =============================================\n\n")
            f.write(schema_sql)
            f.write("\n\n")
            f.write("-- =============================================\n")
            f.write("-- PART 2: SEED DATA\n")
            f.write("-- =============================================\n\n")
            f.write(seed_sql)

        print(f"\n  [OK] Combined SQL written to: {output_path}")
        print("       Copy this file's contents into Supabase SQL Editor.")
        return

    # Try batch execution
    ok, err = execute_sql_batch(schema_sql, "Schema (001_create_tables.sql)")
    if not ok:
        print(f"  [!] Batch schema execution not available: {err[:150]}")
        print("  [*] Attempting statement-by-statement execution...")

        success = 0
        errors = 0
        for i, stmt in enumerate(schema_stmts, 1):
            preview = stmt[:50].replace("\n", " ")
            try:
                resp = httpx.post(
                    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
                    headers=HEADERS,
                    json={"query": stmt},
                    timeout=30.0,
                )
                if resp.status_code in (200, 204):
                    success += 1
                elif "already exists" in resp.text.lower():
                    success += 1
                else:
                    errors += 1
                    if i <= 5:
                        print(f"  [{i}] WARN: {preview}... -> {resp.text[:80]}")
            except Exception as e:
                errors += 1

        print(f"\n  Schema results: {success} OK, {errors} errors")

    # Seed
    ok2, err2 = execute_sql_batch(seed_sql, "Seed Data (002_seed_data.sql)")
    if not ok2:
        print(f"  [!] Batch seed execution not available: {err2[:100]}")

    # Output combined file regardless
    output_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "database", "supabase_full_schema.sql"
    )
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("-- FxZone Full Schema for Supabase\n")
        f.write("-- Execute this in Supabase SQL Editor\n\n")
        f.write("-- === PART 1: TABLES ===\n\n")
        f.write(schema_sql)
        f.write("\n\n-- === PART 2: SEED DATA ===\n\n")
        f.write(seed_sql)

    print(f"\n  [OK] Combined SQL saved to: database/supabase_full_schema.sql")
    print()
    print("=" * 60)
    print("  FxZone Supabase Setup Complete!")
    print()
    print("  If tables were not created via API, paste the contents of")
    print("  database/supabase_full_schema.sql into the Supabase SQL Editor.")
    print("=" * 60)


if __name__ == "__main__":
    main()
