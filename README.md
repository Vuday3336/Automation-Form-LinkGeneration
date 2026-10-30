# HospitalForm AI

Google Form submissions → secure, access-controlled hospital dashboard.

- Architecture & phase plan: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Phase notes (what was built, how it works, how to test): [docs/phases/](docs/phases/)

> **Development uses dummy data only.** Never enter real patient information.

## Requirements

- Node.js 20+ (built and tested on Node 24)
- npm
- A Supabase project (from Phase 2; automated tests use an in-memory Postgres instead)

## First-time setup

```bash
cd backend
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env
npm run secret              # run 3 times: one value each for JWT_SECRET, INTEGRATION_SECRET, FIELD_ENCRYPTION_KEY
# also fill in DATABASE_URL (Supabase) and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD, then:
npm run migrate             # creates the tables in Supabase
npm run seed                # adds demo hospitals + your Super Admin
cd ../frontend
npm install
```

## Running locally (two terminals)

```bash
# Terminal 1: API on http://localhost:5000
cd backend
npm run dev
```

```bash
# Terminal 2: UI on http://localhost:5173
cd frontend
npm run dev
```

## Tests

```bash
cd backend
npm test
```

## Project layout

| Folder | What lives there |
|---|---|
| `backend/` | Express REST API (Node.js) |
| `frontend/` | React + Vite + Tailwind dashboard |
| `google-apps-script/` | Code you paste into the Google Sheet's Apps Script editor (Phase 4) |
| `docs/` | Architecture, phase notes, glossary |
