# Mineral Sens AI — Gemini Chatbot + Supabase PostgreSQL

## What changed
- Normalized the Flask entry point to `app.py` at the repository root.
- Kept the existing login, admin, camera, scan, history, and Arduino bridge code.
- Added authenticated `POST /api/chat`.
- Added `chatbot.js` to Dashboard, Account, and Knowledge pages.
- Added `google-genai` to `requirements.txt`.
- Added `migrate_sqlite_to_supabase.py` for a one-time SQLite-to-Supabase copy.
- Kept the Render persistent disk temporarily so the existing SQLite database can be backed up/migrated.

## Important before deployment
1. Do not delete the existing Render disk or SQLite database.
2. Back up the current SQLite database before switching the live service to Supabase.
3. The RAR supplied to ChatGPT did not contain `users.sqlite3`, so no user records were migrated in this patch.
4. This project uses the existing Flask username/password session system. Supabase is used as PostgreSQL storage; this does not replace the current login with Supabase Auth.
5. The Arduino and camera remain attached to the laboratory PC. Keep running the existing local `arduino_serial_bridge.py` there. Render cannot directly access the PC's USB camera or COM port.

## Supabase connection
For Render, use the Supabase **Session pooler** connection string (IPv4-compatible) from:
Supabase Dashboard -> Connect -> Session pooler.

Set this in Render as `DATABASE_URL`. The connection string should look like:
`postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@<POOLER_HOST>:5432/postgres`

Copy the actual value from Supabase; do not construct the pooler hostname yourself.
URL-encode special characters in the database password if needed.

## Gemini setup
1. Create an API key at https://aistudio.google.com/apikey
2. In Render -> service -> Environment, add:
   - `GEMINI_API_KEY` = your private Gemini API key
   - `GEMINI_MODEL` = `gemini-3.8-flash`
3. Never place the API key in HTML/JavaScript or commit it to GitHub.

## Render settings
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app --workers 1 --threads 8 --timeout 120`
- Health check path: `/health`

The `Procfile` and `render.yaml` in this patch have already been aligned to `app:app`.

## One-time SQLite migration
The source RAR did not include the actual SQLite database file. Before switching production traffic:
1. Obtain a backup copy of the current `users.sqlite3` from the existing Render persistent disk (or from the local machine if that is the authoritative database).
2. Keep the source SQLite file unchanged as a backup.
3. Set `DB_PATH` to the path of that file and `DATABASE_URL` to the Supabase Session pooler URL in a safe migration environment.
4. Install dependencies with `pip install -r requirements.txt`.
5. Run `python migrate_sqlite_to_supabase.py`.
6. Verify counts in Supabase for `users`, `scans`, `scan_requests`, `live_readings`, `camera_live_values`, `camera_cycle_saves`, and `app_settings`.
7. Only then point the production Render service at Supabase by setting `DATABASE_URL` and redeploying.

The migration script preserves IDs and skips rows that already exist. It is safe to rerun for rows with the same primary/unique keys, but still keep a separate backup.

## Chatbot behavior
- Only logged-in members can use `/api/chat`.
- The backend limits a message to 1,500 characters and applies a basic per-account request limit.
- It includes the latest saved soil scan belonging to the current account as context.
- It does not read another member's scans.
- The chat history is held in the browser session memory and is not saved permanently to Supabase yet.
- The chatbot provides general soil information; it must not be treated as a laboratory certification or a substitute for local agronomic recommendations.

## Local development
Install:
`pip install -r requirements.txt`

Set environment variables in a local `.env` (never commit `.env`):
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `DATABASE_URL` (optional locally if testing SQLite)

Run:
`python app.py`

The local camera/Arduino bridge should continue running on the lab computer as in the existing setup.
