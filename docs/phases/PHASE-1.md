# Phase 1: Project setup, folder structure & architecture

## What was built

A working skeleton: an Express API that boots with security middleware and a health endpoint, a React
page that calls it, automated tests, and validated configuration. No database or business features yet:
those come in Phases 2–6, on top of this base.

## Files created

| File | Purpose |
|---|---|
| `.gitignore` | Stops `node_modules/` and every `.env` file from ever being committed |
| `docs/ARCHITECTURE.md` | System diagram, design decisions, phase plan |
| `backend/package.json` | Lists dependencies and scripts (`dev`, `start`, `test`, `secret`) |
| `backend/.env.example` | Template of every setting, with no real values. Copy it to `.env` |
| `backend/src/config/env.js` | Loads `.env`, checks every variable with Zod, refuses to start if something's wrong |
| `backend/src/app.js` | Builds the Express app: Helmet → CORS → rate limit → JSON parser → routes → errors |
| `backend/src/server.js` | Starts the app on a port; shuts down gracefully on Ctrl+C |
| `backend/src/utils/logger.js` | Logging that automatically hides secrets and patient fields |
| `backend/src/utils/apiResponse.js` | One response shape for the whole API + `ApiError` helper |
| `backend/src/middleware/errorMiddleware.js` | 404 handler + central error handler (no stack traces leak to users) |
| `backend/tests/setup.js` | Gives tests fake secrets so they never use your real `.env` |
| `backend/tests/health.test.js` | 6 tests: health, security headers, CORS allow/deny, 404, bad JSON |
| `frontend/package.json`, `vite.config.js`, `index.html` | Vite + React + Tailwind project; dev proxy `/api` → `:5000` |
| `frontend/src/main.jsx` | Mounts React into the page and turns on the router |
| `frontend/src/App.jsx` | Route table (URL → page) |
| `frontend/src/lib/api.js` | Shared Axios client used for every backend call |
| `frontend/src/pages/SystemStatusPage.jsx` | Shows whether the backend is reachable |
| `frontend/src/pages/NotFoundPage.jsx` | The 404 page |

## How a request flows (try it: open http://localhost:5173)

1. The browser loads the React app from **Vite** (port 5173).
2. `SystemStatusPage` calls `api.get('/health')` → the browser requests `http://localhost:5173/api/health`.
3. Vite's **proxy** forwards it to Express on port 5000. To the browser it's all one site.
4. Express runs each **middleware** in order:
   `helmet` (adds security headers) → `cors` (is this origin allowed?) → `rateLimit` (too many requests?)
   → `express.json` (parse the body) → the `/api/health` handler → sends JSON.
5. React receives `{ success: true, data: { status: 'ok', ... } }` and shows **Online**.

If anything throws along the way, Express skips to `errorHandler`, which picks a status code and sends
`{ success: false, message }`.

## Why each backend package exists

| Package | Problem it solves |
|---|---|
| `express` | The web server framework: maps URLs to code |
| `helmet` | Adds ~15 HTTP security headers (clickjacking, MIME sniffing, HSTS…) in one line |
| `cors` | Browsers block cross-site API calls unless the server allows them; we allow only our frontend |
| `express-rate-limit` | Caps requests per IP: slows brute-force logins and abuse |
| `cookie-parser` | Reads the login cookie (Phase 6) |
| `dotenv` | Loads `.env` into `process.env` |
| `zod` | Validates data (env vars now, request bodies later) |
| `pg` | Talks to Supabase's PostgreSQL database (Phase 2; replaced `mongoose` when we switched to Supabase) |
| `bcrypt` | One-way password hashing (Phase 6) |
| `jsonwebtoken` | Signs/verifies login tokens (Phase 6) |
| `supertest` *(dev)* | Sends fake HTTP requests to the app in tests, with no real server needed |
| `@electric-sql/pglite` *(dev)* | Throwaway in-memory Postgres for tests (Phase 2+) |

Frontend: `react`, `react-dom`, `react-router`, `axios`, `react-hook-form` + `@hookform/resolvers` + `zod`
(forms & validation), `lucide-react` (icons), `recharts` (charts), `tailwindcss` (styling), `vite` (dev server/build).

## Commands & expected output

```bash
cd backend
npm test
```
Expected: `ℹ tests 6`, `ℹ pass 6`, `ℹ fail 0`.

```bash
cd backend
npm run dev
```
Expected (after you created `.env`, including `DATABASE_URL` from Phase 2):
```
INFO Connected to PostgreSQL (Supabase)
INFO API listening on http://localhost:5000 (development)
```
Then visit http://localhost:5000/api/health to see the JSON. With the frontend running, http://localhost:5173 shows **Online**.

## Configuring secrets yourself

1. `cd backend` then `copy .env.example .env`.
2. Run `npm run secret`, which prints a random 96-character string made by Node's `crypto.randomBytes`
   (cryptographically secure). Paste it after `JWT_SECRET=`.
3. Run it again and paste the new value after `INTEGRATION_SECRET=`. **Use different values.**
4. Don't share these, don't commit them, and don't paste them into chats. If one leaks, generate a new one.

## Common errors

| You see | Cause | Fix |
|---|---|---|
| `Invalid environment configuration: - JWT_SECRET: is missing` (or `must be at least 32 characters`) | No `.env`, or the secret is empty/short | Do the "Configuring secrets" steps above |
| `EADDRINUSE: address already in use :::5000` | Another backend is already running | Close the other terminal, or set `PORT=5001` in `.env` (and update `vite.config.js` proxy) |
| Frontend shows **Offline** / `Request failed with status code 500` | Backend not running; Vite's proxy can't reach it | Start `npm run dev` in `backend/` |
| `npm warn install-scripts ... bcrypt` | npm 12 blocks package install scripts by default | Harmless here: bcrypt ships prebuilt binaries (verified working) |
| `'vite' is not recognized` | Dependencies not installed | `npm install` inside `frontend/` |

## Glossary (with this project's examples)

- **Backend**: code on a server you control (`backend/`). It holds secrets and talks to the database.
- **Frontend**: code that runs in the user's browser (`frontend/`). Never put secrets here: anyone can read it.
- **API**: a defined way for programs to talk. Our API is the list of URLs the backend answers.
- **REST API**: an API style built on URLs + HTTP verbs: `GET /api/submissions` reads, `PATCH /api/submissions/:id/status` changes.
- **JSON**: the text format for data both sides understand: `{ "status": "ok" }`.
- **Middleware**: a function that runs on every request before your route: `helmet`, `cors`, later `authMiddleware`.
- **Environment variables**: settings kept outside the code (`.env`), so secrets aren't in Git and each machine can differ.
- **Webhook**: "call me when something happens". Our Apps Script will POST to the backend each time a form is submitted.
- **Trigger**: Google's mechanism that runs our script automatically on an event (`onFormSubmit`).
- **Authentication**: *who are you?* (login). **Authorization**: *what are you allowed to do?* (roles, hospital access).
- **JWT**: a signed token proving you logged in; the server can verify it without a database lookup.
- **Secure token**: an unguessable random string (from `crypto.randomBytes`) in a link; we store only its hash.
- **Database schema**: the defined shape of the data: tables, columns, types, rules (`db/migrations/001_initial_schema.sql`). See PHASE-2.md.
- **Deployment**: putting the app on internet servers so it runs without your PC (Phase 10).
