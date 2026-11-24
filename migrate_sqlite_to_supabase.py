"""
One-time migration from the existing SQLite database to Supabase PostgreSQL.

Run this from the Render Shell after setting DATABASE_URL to the Supabase
Session Pooler connection string. Keep the Render persistent disk mounted
until the migration and verification are complete.
"""
import os
import sqlite3
import sys
import psycopg

SQLITE_PATH = os.getenv("DB_PATH", "/var/data/users.sqlite3")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

TABLES = [
    "users",
    "app_settings",
    "scan_requests",
    "scans",
    "live_readings",
    "camera_live_values",
    "camera_cycle_saves",
]

def main():
    if not DATABASE_URL:
        raise SystemExit("ERROR: DATABASE_URL is not set.")
    if not os.path.isfile(SQLITE_PATH):
        raise SystemExit(f"ERROR: SQLite database not found: {SQLITE_PATH}")

    # Importing the Flask app initializes the Supabase PostgreSQL schema using
    # the same table definitions as production.
    import app  # noqa: F401

    src = sqlite3.connect(SQLITE_PATH)
    src.row_factory = sqlite3.Row

    with psycopg.connect(DATABASE_URL) as dst:
        with dst.cursor() as cur:
            for table in TABLES:
                exists = src.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                    (table,)
                ).fetchone()
                if not exists:
                    print(f"SKIP {table}: not present in SQLite")
                    continue

                rows = src.execute(f'SELECT * FROM "{table}"').fetchall()
                if not rows:
                    print(f"OK {table}: 0 rows")
                    continue

                columns = [item["name"] for item in src.execute(
                    f'PRAGMA table_info("{table}")'
                ).fetchall()]
                col_sql = ", ".join('"' + c.replace('"', '""') + '"' for c in columns)
                placeholders = ", ".join(["%s"] * len(columns))
                sql = (
                    f'INSERT INTO "{table}" ({col_sql}) '
                    f'VALUES ({placeholders}) ON CONFLICT DO NOTHING'
                )

                inserted = 0
                for row in rows:
                    cur.execute(sql, tuple(row[c] for c in columns))
                    if cur.rowcount == 1:
                        inserted += 1
                print(f"OK {table}: read {len(rows)} rows, inserted {inserted}; existing rows kept")

            # Restore BIGSERIAL counters after preserving SQLite IDs.
            for table in ("scan_requests", "scans"):
                cur.execute(
                    f"""SELECT setval(
                        pg_get_serial_sequence('{table}', 'id'),
                        GREATEST(COALESCE((SELECT MAX(id) FROM {table}), 1), 1),
                        EXISTS(SELECT 1 FROM {table})
                    )"""
                )
        dst.commit()

    src.close()
    print("Migration completed. Verify row counts in Supabase before switching traffic.")

if __name__ == "__main__":
    main()
