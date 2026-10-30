# HospitalForm AI

Google Form submissions → secure, access-controlled hospital dashboard.

Every form response is sent by Google Apps Script to an Express API. The API validates it, ignores
duplicates, encrypts patient fields, stores it in Supabase (PostgreSQL) and creates an expiring
secure link. Staff log in to a React dashboard and see only their own hospitals' submissions.

> **Development uses dummy data only.** Never enter real patient information.

| Doc | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, design decisions, phase plan |
| [docs/phases/PHASE-1.md](docs/phases/PHASE-1.md) | Project setup, security middleware, glossary |
| [docs/phases/PHASE-2.md](docs/phases/PHASE-2.md) | Supabase, tables, encryption, migrations |
| [docs/phases/PHASE-3-TO-7.md](docs/phases/PHASE-3-TO-7.md) | APIs, secure links, roles, dashboard, testing |
| [google-apps-script/README.md](google-apps-script/README.md) | Connecting a real Google Form |

## Requirements

- Node.js 20+ (built and tested on Node 24)
- A Supabase project (optional for local development: see `dev:local` below)

## First-time setup

```bash
cd backend
npm install
```
```bash
cd frontend
npm install
```

`backend/.env` holds all settings (copy `backend/.env.example` if it doesn't exist; generate each
secret with `npm run secret`). To use Supabase, set `DATABASE_URL` to your project's **Session pooler**
connection string (Supabase → Connect → Session pooler), then:

```bash
cd backend
npm run migrate
```
```bash
cd backend
npm run seed
```

## Running locally (two terminals)

Backend, either on Supabase:
```bash
cd backend
npm run dev
```
or fully offline on a local Postgres with demo data (no Supabase needed):
```bash
cd backend
npm run dev:local
```

Frontend (http://localhost:5173):
```bash
cd frontend
npm run dev
```

Log in as `admin@hospitalform.test` with `SEED_ADMIN_PASSWORD` from `backend/.env`.
Demo accounts for each role are listed in [PHASE-3-TO-7.md](docs/phases/PHASE-3-TO-7.md#demo-accounts-dummy-data).

## Tests

```bash
cd backend
npm test
```

## Project layout

| Folder | What lives there |
|---|---|
| `backend/` | Express REST API: routes → middleware → controllers → services → models |
| `backend/db/migrations/` | SQL that creates the database tables |
| `frontend/` | React + Vite + Tailwind dashboard |
| `google-apps-script/` | Code you paste into the Google Sheet's Apps Script editor |
| `postman/` | Postman collection with every endpoint |
| `docs/` | Architecture and phase-by-phase explanations |
