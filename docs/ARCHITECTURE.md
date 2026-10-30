# HospitalForm AI — Architecture & Implementation Plan

> Development rule: **dummy data only**. No real patient names or medical details anywhere — not in
> Google Forms, not in the database, not in screenshots.

## 1. The big picture

```
 ┌──────────────┐  submit   ┌──────────────┐  new row   ┌──────────────────────────┐
 │ Google Form  │ ────────► │ Google Sheet │ ─────────► │ Apps Script (onFormSubmit│
 └──────────────┘           └──────────────┘            │ installable trigger)     │
                                                        └────────────┬─────────────┘
                                         HTTPS POST + secret header  │ (UrlFetchApp)
                                                                     ▼
 ┌──────────────────────── Node.js + Express backend ─────────────────────────────┐
 │ integrationAuth → validate (Zod) → dedupe → submissionService → linkService     │
 │                                         │                          │            │
 │                                         ▼                          ▼            │
 │                            Supabase (PostgreSQL) ◄── auditService (AuditLog)  │
 └───────────────▲─────────────────────────────────────────────────────────────────┘
                 │ REST API (JSON) + httpOnly auth cookie
 ┌───────────────┴──────────────┐
 │ React (Vite) dashboard       │  ← staff log in, see the list, open secure links
 └──────────────────────────────┘
```

**Who talks to whom**

| From | To | How | Authenticated by |
|---|---|---|---|
| Google Form | Google Sheet | Built into Google ("Link to Sheets") | Google |
| Apps Script | Backend | HTTPS `POST /api/integrations/google-form/submissions` | Shared secret in `X-Integration-Secret` header (stored in Script Properties / `.env`) |
| Browser (React) | Backend | HTTPS REST calls with Axios | JWT inside an **httpOnly cookie** |
| Backend | Supabase Postgres | `pg` (node-postgres) over TLS | `DATABASE_URL` in `.env` |
| Anyone with Supabase's public `anon` key | Supabase REST API | — | **Blocked**: RLS on, no policies, privileges revoked |

## 2. Key design decisions (and why)

1. **Two separate npm projects** (`backend/`, `frontend/`). Each has its own `package.json`, so you can
   run, test and deploy them independently. That's the standard MERN layout.
2. **ES Modules (`import`/`export`) everywhere**, so the backend and frontend use the same syntax.
3. **Layered backend**: `routes → middleware → controllers → services → models`.
   - *Routes* only map URLs to functions.
   - *Controllers* read the request and send the response: thin.
   - *Services* hold the business logic (dedupe, link generation, audit), so it can be reused and tested.
   - *Models* are data-access modules: all SQL for one table lives in one file (`models/Submission.js`).
     The table *shape* itself is defined in SQL migrations (`backend/db/migrations/`).
4. **The secure link is not a free pass.** The link `/submissions/secure/<token>` only *identifies* a
   submission without exposing its ID. To see data, the person must also be **logged in** and have
   **access to that hospital**. The database stores only a SHA-256 *hash* of the token, so a leaked
   database backup can't be turned back into working links. Links expire and admins can revoke them.
5. **Auth = JWT in an httpOnly cookie.** JavaScript in the browser can't read the cookie, which protects
   it from XSS token theft. `SameSite` and strict CORS stop other sites from using it.
6. **Patient data protection**: `patientName` is only returned to roles allowed to see it. It never
   appears in URLs, logs or audit metadata. The AI layer (optional, Phase 11) only gets de-identified fields.
7. **Duplicate protection on two levels**: Apps Script sends a stable `sourceResponseId`, and Postgres
   has a **unique constraint** on `(source, source_response_id)` used with `INSERT ... ON CONFLICT DO NOTHING`. Even if Google fires the trigger twice, the
   second insert is rejected and the API returns the existing record.
8. **No heavy extras**: Node's built-in `--watch` replaces nodemon; Node's built-in test runner plus
   `supertest` replace Jest; a small custom logger replaces Winston.
9. **One small addition to your spec: a `hospitals` table.** You asked for a Hospital Management page
   and a `hospitalAccess` field on users. Both need a list of hospitals to point to (code, name, isActive).
10. **Supabase as the database (switched from MongoDB at your request).** Supabase is hosted PostgreSQL.
    We use it as a database only: the Express backend is the single gatekeeper (roles, hospital
    isolation, audit). Its auto-generated public REST API is locked down by Row Level Security with no
    policies. Login stays bcrypt + JWT as specified (Supabase Auth could replace it later). Hospital
    access is a real join table (`user_hospital_access`) so the database guarantees every entry is valid.
11. **Patient name and form answers are encrypted by the backend (AES-256-GCM)** before being stored.
    Supabase also encrypts its disks, but this extra layer means a database dump or a mistaken
    dashboard share shows only ciphertext. Metadata used for filtering (hospital, department, status,
    dates) stays readable so search and charts still work.

## 3. Final folder structure (target)

```
D:\AI Agent
├── backend/                 Express API (Phases 1–6)
│   ├── src/
│   │   ├── config/          env.js (validated settings), db.js (Postgres pool), migrations.js
│   │   ├── models/          data access: Submission, User, AuditLog, Hospital
│   │   ├── controllers/     auth, submission, dashboard, integration
│   │   ├── routes/          URL → controller mapping
│   │   ├── middleware/      auth, role, validate, error, integrationAuth
│   │   ├── services/        googleForm, submission, link, audit
│   │   ├── utils/           generateToken, apiResponse, logger
│   │   ├── validators/      Zod schemas
│   │   ├── app.js           builds the Express app (no network listening)
│   │   └── server.js        connects DB + starts listening
│   ├── db/migrations/       SQL files that create/change tables (001_initial_schema.sql, ...)
│   ├── scripts/             migrate.js, seed.js (dummy data + first admin)
│   ├── tests/               automated API tests
│   └── .env.example
├── frontend/                React + Vite + Tailwind dashboard (Phase 7)
├── google-apps-script/      Code.gs, README.md, sample-payload.json (Phase 4)
├── postman/                 Postman collection (Phase 8)
└── docs/                    This file, phase notes, glossary
```

## 4. Phase plan

| Phase | Deliverable | How you verify it |
|---|---|---|
| **1** Setup | Folders, packages, env validation, Express skeleton with security middleware, health endpoint, React+Tailwind shell that calls the backend | `npm test`, open `http://localhost:5173`, which shows "Backend: online" |
| **2** Database | Supabase connection, SQL schema + indexes + RLS, data-access models, field encryption, migrate & seed scripts | `npm test`; `npm run migrate` + `npm run seed`, then view tables in Supabase Table Editor |
| **3** APIs | Validators, controllers, services, routes for submissions & dashboard | Automated tests + Postman |
| **4** Google | `Code.gs` (dynamic questions, retries, dedupe), setup guide, sample payload | Run `testWithSamplePayload()` from the Apps Script editor |
| **5** Links | Token generation, hashing, expiry, revocation, integration endpoint | Tests for valid / expired / revoked links |
| **6** Auth | Register (admin-only + first-run setup), login, logout, `me`, RBAC, hospital isolation | Tests for 401/403 and cross-hospital access |
| **7** Frontend | All 10 pages, reusable components, charts | Click through the UI |
| **8** E2E | Real Google Form → backend (via a tunnel such as ngrok/cloudflared) | A submission appears on the dashboard |
| **9** Security review | Review checklist, fixes, indexes, rate-limit tuning | Review notes + green tests |
| **10** Deploy | Render/Railway (API) + Vercel/Netlify (UI) + Supabase guide | Live URLs |
| *11 (optional)* AI | Isolated `aiService` that only receives de-identified data | Unit tests with AI disabled/enabled |

## 5. External setup you will do yourself (never share these with anyone)

| What | Where | Needed from |
|---|---|---|
| A Supabase project + its Session pooler connection string | supabase.com/dashboard | Phase 2 (tests don't need it: they use an in-memory Postgres) |
| `JWT_SECRET`, `INTEGRATION_SECRET`, `FIELD_ENCRYPTION_KEY` (random strings) | your `backend/.env` | Phase 1–2 |
| A Google Form + linked Sheet (dummy questions) | forms.google.com | Phase 4 |
| A public HTTPS URL for your local backend (ngrok / cloudflared) **or** a deployed backend | — | Phase 8 (Google can't reach `localhost`) |
