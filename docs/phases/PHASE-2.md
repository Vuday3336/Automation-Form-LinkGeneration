# Phase 2: Database (Supabase / PostgreSQL)

## What is Supabase, and why this setup?

**Supabase** is a hosted **PostgreSQL** database with a web dashboard (Table Editor, SQL Editor, logs)
plus optional extras (auth, storage, an auto-generated REST API). PostgreSQL is a *relational* database:
data lives in **tables** with fixed **columns**, and the database itself enforces rules such as
"status must be one of these five values" or "this email must be unique".

How we use it:

```
Express backend ──(pg driver, TLS, DATABASE_URL)──► Supabase Postgres
Browser / anyone with the public anon key ──► Supabase REST API ──► ✗ blocked (RLS, no policies)
```

- **The backend is the only door.** All role checks, hospital isolation and audit logging happen in
  Express, so every rule is in one place.
- Supabase's auto-generated REST API is **disabled for our tables**: Row Level Security (RLS) is ON with
  zero policies, and privileges are revoked from the `anon` and `authenticated` roles. Even if someone
  finds your project's public key, they get no rows.
- We use plain **SQL migrations** instead of an ORM: you can read exactly what the database looks like.

## Files created / changed

| File | Purpose |
|---|---|
| `backend/db/migrations/001_initial_schema.sql` | Creates all tables, rules (constraints), indexes, `updated_at` triggers, RLS |
| `backend/src/config/db.js` | Connection pool to Supabase; `query()`, `transaction()`, health check |
| `backend/src/config/migrations.js` | Applies new `.sql` files once, in order, each inside a transaction |
| `backend/src/models/Hospital.js`, `User.js`, `Submission.js`, `AuditLog.js` | All SQL for each table; convert `snake_case` rows ↔ `camelCase` objects |
| `backend/src/utils/encryption.js` | AES-256-GCM encrypt/decrypt for patient name & form answers |
| `backend/src/services/seedService.js` | Creates demo hospitals + first Super Admin (safe to re-run) |
| `backend/scripts/migrate.js`, `seed.js` | `npm run migrate`, `npm run seed` |
| `backend/tests/helpers/testDb.js` | Runs a real Postgres **in memory** (PGlite) for tests |
| `backend/tests/database.test.js`, `encryption.test.js` | 18 new tests |
| changed: `env.js`, `.env.example`, `server.js`, `app.js`, `errorMiddleware.js`, `logger.js` | `DATABASE_URL`, `FIELD_ENCRYPTION_KEY`, DB status in `/api/health`, Postgres error codes, more redaction |

## The tables

| Table | Holds | Key protections |
|---|---|---|
| `hospitals` | code, name, is_active | unique code; unique name (any case) |
| `users` | name, email, password_hash, role, is_active | unique email (any case); role must be one of 4 values |
| `user_hospital_access` | (user, hospital) pairs = `hospitalAccess` | both must exist (foreign keys); removed automatically if the user is deleted |
| `submissions` | everything from the form | unique `submission_id`; **unique (source, source_response_id)** = no duplicates; status limited to 5 values; `patient_name_encrypted` & `form_data_encrypted` are ciphertext; only `secure_token_hash` stored; `archived_at` = soft delete |
| `audit_logs` | who did what, when | metadata never contains patient/medical data |

**Indexes** make common lookups fast (like a book's index): submissions by hospital + date, by status,
by department; audit logs by submission and by user.

**Why encrypt in the app as well?** Supabase already encrypts disks. But anyone who can open the
Table Editor, or a leaked backup, would still see plain names. With app-level encryption they see
`v1.Xk3...`: only the backend holding `FIELD_ENCRYPTION_KEY` can read it. Filter fields (hospital,
department, status, dates) stay plain so search and charts work.

## How a submission gets stored without duplicates

```sql
insert into submissions (...) values (...)
on conflict on constraint submissions_source_response_key do nothing
returning ...;
```
If Google's trigger fires twice for the same response, the second insert hits the unique constraint
and *does nothing*. The code then fetches and returns the existing record. This works even if both
requests arrive at the same millisecond, because the database, not our code, enforces it.

## Setting up your Supabase project (you do this; never share the password)

1. Go to https://supabase.com/dashboard → **New project** (or **Restore** a paused one).
   Name it e.g. `hospitalform-ai`, set a strong database password, pick the region nearest you.
2. When it's ready, click **Connect** (top bar) → **Session pooler** → copy the URI.
   (Use *Session pooler*: the *Direct connection* needs IPv6, which many home networks lack.)
3. In `backend/.env`, set `DATABASE_URL=` to that URI with `[YOUR-PASSWORD]` replaced by your password.
4. Run `npm run secret` and put the value in `FIELD_ENCRYPTION_KEY=`.
   **Back it up somewhere safe** (e.g. a password manager): lose it and stored patient fields are unreadable.
5. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (12+ characters) for your first login.
6. *(Optional, recommended for production)* Project Settings → Database → SSL Configuration →
   **Download certificate**, then set `DATABASE_SSL_CA_PATH` to the file's full path.

## Commands & expected output

```bash
cd backend
npm test
```
Expected: `ℹ tests 25`, `ℹ pass 25`, `ℹ fail 0` (no internet or Supabase needed).

```bash
npm run migrate
```
Expected: `Connected to PostgreSQL (Supabase)` then `Applied migrations: 001_initial_schema.sql`.
Running it again prints `Database is already up to date`.

```bash
npm run seed
```
Expected: `Seed complete: 3 hospital(s) added (3 total); Super Admin created for <your email>`.

Then open Supabase → **Table Editor**: you'll see `hospitals` (3 demo rows), `users` (1 row, password
shown only as a `$2b$12$...` bcrypt hash), and empty `submissions` / `audit_logs`.
Start the API with `npm run dev`: http://localhost:5000/api/health now shows `"database": "up"`.

## Common errors

| You see | Cause | Fix |
|---|---|---|
| `DATABASE_URL is not set` | `.env` missing the URI | Step 2–3 above |
| `password authentication failed for user "postgres..."` | Wrong DB password in the URI | Reset it under Project Settings → Database, update `.env` |
| `ENOTFOUND db.<ref>.supabase.co` or `ENETUNREACH` | Used the *Direct connection* (IPv6) | Use the **Session pooler** URI |
| `connect ETIMEDOUT` / `Tenant or user not found` | Project paused, or wrong region host | Restore the project in the dashboard; re-copy the URI |
| `self-signed certificate in certificate chain` | `DATABASE_SSL_CA_PATH` points to the wrong file | Re-download Supabase's certificate |
| `relation "hospitals" does not exist` | Tables not created yet | `npm run migrate` |
| `Seed settings invalid: SEED_ADMIN_PASSWORD must be at least 12 characters` | Seed values missing/short | Fill `SEED_ADMIN_*` in `.env` |
| `/api/health` returns 503 `database: down` | DB became unreachable after startup | Check the Supabase dashboard status; restart the API |

## New terms

- **Table / row / column**: a table is like a spreadsheet tab; each row is one record; columns are fields.
- **Primary key**: the column that uniquely identifies a row (`id`, a random UUID).
- **Foreign key**: a column that must point to an existing row in another table (`hospital_id`).
- **Constraint**: a rule the database enforces (`unique`, `check (status in (...))`, `not null`).
- **Index**: a lookup structure that makes searching a column fast.
- **Migration**: a versioned SQL file that changes the schema; applied once, in order, tracked in `schema_migrations`.
- **Transaction**: a group of statements that succeed or fail together (creating a user + their hospital access).
- **Row Level Security (RLS)**: Postgres rules deciding which rows a role may see; with no policies, none.
- **Connection pool**: a set of open DB connections reused across requests, instead of reconnecting each time.
