# Phases 3–7: APIs, Google integration, secure links, auth, dashboard

This guide covers everything built after the database: how a form response travels through the
system, every file involved, how to run and test it, and what to do when something fails.

## The journey of one form response

```
Google Form submit
  → new row in the linked Google Sheet
  → Apps Script trigger runs onFormSubmitHandler (google-apps-script/Code.gs)
  → POST /api/integrations/google-form/submissions   + X-Integration-Secret header
      integrationLimiter        max 120 requests/minute
      requireIntegrationSecret  constant-time secret check (401 + audit entry if wrong)
      validate(googleFormPayloadSchema)   shape/size checks (400 with field messages)
      submissionService.ingestGoogleFormSubmission
         googleFormService.normalizeGoogleFormPayload   finds hospital/department/type/patient by question title
         findHospitalByNameOrCode                       matches the hospital (else "unassigned")
         linkService.createLink                         random token + SHA-256 hash + expiry
         ONE TRANSACTION: insert submission (ON CONFLICT DO NOTHING) + audit "submission.received"
  ← 201 { submissionId, secureUrl, linkExpiresAt, duplicate:false }
  → Apps Script writes Submission ID + Secure Link into the sheet row
```

When someone opens `https://<frontend>/submissions/secure/<token>`:

```
React route /submissions/secure/:token
  → not logged in? → /login?next=/submissions/secure/<token> → log in → back to the link
  → GET /api/submissions/secure/<token>   (cookie sent automatically)
      requireAuth        verifies JWT cookie, reloads user (deactivated = blocked immediately)
      hash token → find submission → revoked? 410 → expired? 410 → user has this hospital? else 403
      every denial is written to the audit log; success logs "submission.viewed (via secure_link)"
  ← submission details (patient name only for roles allowed to see it)
```

## Files added in these phases

| Area | Files | Purpose |
|---|---|---|
| Routes | `routes/authRoutes.js`, `submissionRoutes.js`, `dashboardRoutes.js`, `integrationRoutes.js`, `adminRoutes.js` | URL → middleware chain → controller |
| Controllers | `controllers/authController.js`, `submissionController.js`, `dashboardController.js`, `integrationController.js`, `adminController.js` | Read validated input, call a service, send JSON |
| Services | `services/submissionService.js`, `linkService.js`, `googleFormService.js`, `authService.js`, `hospitalService.js`, `dashboardService.js`, `auditService.js`, `sampleData.js` | All business rules |
| Middleware | `authMiddleware.js`, `roleMiddleware.js`, `validateMiddleware.js`, `integrationAuthMiddleware.js` | Login check, permissions, validation, machine auth |
| Validators | `validators/submissionValidator.js`, `authValidator.js`, `common.js` | Zod schemas for every request |
| Utils | `utils/generateToken.js` | Secure tokens, hashes, submission IDs, JWT, constant-time compare |
| DB | `config/pgliteDriver.js`, `scripts/dev-local.js`, `scripts/seedConfig.js`, `scripts/send-sample.js` | Local Postgres mode, demo data, sample sender |
| Tests | `tests/api.test.js` | 30 API tests (the 13 scenarios from the spec + roles) |
| Google | `google-apps-script/Code.gs`, `README.md`, `sample-payload.json` | Sheet trigger code and step-by-step setup |
| Postman | `postman/HospitalForm-AI.postman_collection.json` | Every endpoint, ready to import |
| Frontend | `src/context/AuthContext.jsx`, `components/…`, `pages/…` (10 pages), `lib/useApi.js`, `lib/permissions.js`, `lib/format.js` | The dashboard |

## Roles and what they can do

| Action | Super Admin | Hospital Admin | Staff | Viewer |
|---|---|---|---|---|
| See submissions | all hospitals | own hospitals | own hospitals | own hospitals |
| See patient names | ✓ | ✓ | ✓ | ✗ (shown as *Restricted*) |
| Change status | ✓ | ✓ | ✓ | ✗ |
| Edit details / assign hospital | ✓ | ✓ (own hospitals) | ✗ | ✗ |
| Generate / revoke links, archive | ✓ | ✓ | ✗ | ✗ |
| Manage users | everyone | Staff & Viewers in own hospitals | ✗ | ✗ |
| Manage hospitals, integration settings | ✓ | ✗ | ✗ | ✗ |
| Audit logs | all | own hospitals' submissions | ✗ | ✗ |

The table lives in one place, `backend/src/middleware/roleMiddleware.js`. The frontend copy in
`frontend/src/lib/permissions.js` only hides buttons; the backend always re-checks.

## API reference

| Method & path | Who | Notes |
|---|---|---|
| `POST /api/auth/login` | anyone | sets httpOnly cookie; 10 attempts / 15 min |
| `POST /api/auth/logout` | anyone | clears cookie |
| `GET /api/auth/me` | logged in | current user |
| `POST /api/auth/register` | admins | create user (see role rules) |
| `PATCH /api/auth/password` | logged in | change own password |
| `POST /api/integrations/google-form/submissions` | Apps Script (secret header) | 201 created / 200 duplicate |
| `GET /api/integrations/google-form/info` · `POST …/test` | Super Admin | settings page, test submission |
| `GET /api/submissions` | logged in | `page, limit, search, status, department, submissionType, hospitalId, sortBy, order` |
| `GET /api/submissions/:submissionId` | logged in + hospital access | details + status history |
| `GET /api/submissions/secure/:token` | logged in + hospital access | 404 unknown, 410 expired/revoked |
| `PATCH /api/submissions/:submissionId/status` | staff+ | `{ "status": "Approved" }` |
| `PATCH /api/submissions/:submissionId` | admins | department, submissionType, hospitalId |
| `DELETE /api/submissions/:submissionId` | admins | **archive** (soft delete) + revoke link |
| `POST` / `DELETE /api/submissions/:submissionId/link` | admins | new link (shown once) / revoke |
| `GET /api/dashboard/stats` · `recent-submissions` · `department-stats` | logged in | scoped to your hospitals |
| `GET/POST/PATCH /api/hospitals` | list: admins; change: Super Admin | |
| `GET/PATCH /api/users` | admins | |
| `GET /api/audit-logs` | admins | `action, submissionId, page, limit` |

**Why "delete" archives:** hospital records usually have legal retention periods. Archiving hides
the record, revokes its link and is audited, but the row is kept. A real purge should be a deliberate,
separately approved job (not an API button).

## Running everything

You have two ways to run the backend:

```bash
cd backend
npm run dev:local
```
Uses a local Postgres saved in `backend/.local-db` with demo data. No internet needed and it never
touches Supabase. Delete that folder to start over.

```bash
cd backend
npm run dev
```
Uses Supabase (`DATABASE_URL` in `.env`). Your Supabase project already has the tables and the same
demo accounts.

Then the frontend:

```bash
cd frontend
npm run dev
```
Open http://localhost:5173.

### Demo accounts (dummy data)

| Email | Role | Hospitals |
|---|---|---|
| `admin@hospitalform.test` | Super Admin | all |
| `dcgh.admin@hospitalform.test` | Hospital Admin | Demo City General |
| `dcgh.staff@hospitalform.test` | Staff | Demo City General |
| `svmc.viewer@hospitalform.test` | Viewer | Sample Valley Medical |

Passwords: `SEED_ADMIN_PASSWORD` (admin) and `SEED_DEMO_PASSWORD` (the other three) in `backend/.env`.
Log in as different users side by side (e.g. one normal and one private window) to see hospital
isolation and the hidden patient names.

## Testing

```bash
cd backend
npm test
```
Expected: `ℹ tests 55`, `ℹ pass 55`, `ℹ fail 0`.

The spec's 13 scenarios and where they're tested:

| # | Scenario | Test (`tests/…`) |
|---|---|---|
| 1 | Successful Google Form submission | api: *1. stores a submission…* |
| 2 | Invalid integration secret | api: *2. rejects a wrong or missing…* |
| 3 | Duplicate submission | api: *3. a duplicate response…* + database: *duplicate Google response* |
| 4 | Missing required fields | api: *4. missing required fields…* |
| 5 | Database connection failure | health: *503 when the database connection fails*; startup exits with a clear message |
| 6 | Secure link generation | api: *6. only the hash…*, *a valid link needs login…* |
| 7 | Expired link | api: *7. an expired link returns 410* |
| 8 | Revoked link | api: *8. a revoked link returns 410* |
| 9 | Unauthorized access | api: */me requires login*, *forged cookie*, role 403 checks |
| 10 | Hospital-level restrictions | api: *10. a user from another hospital…*, *hospital isolation in lists* |
| 11 | Dashboard data | api: *11. stats are scoped…* |
| 12 | Status updates | api: *12. status updates are saved…* |
| 13 | Apps Script integration | `npm run send-sample` (below) + `testWithSamplePayload()` in Apps Script |

**Without Google**, with the backend running:

```bash
cd backend
npm run send-sample
```
Expected first time: `HTTP 201` with a `secureUrl`. Run it again: `HTTP 200`, `"duplicate": true`.
Or click **Integration → Send test submission** in the dashboard.

**Postman:** Import `postman/HospitalForm-AI.postman_collection.json`, fill in the collection
variables (`password`, `integrationSecret`) from your `.env`, run *Auth → Login*, then any request.

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| Login says *Invalid email or password* | Wrong password, or seed didn't run | Check `.env`; `npm run seed` (Supabase) or restart `dev:local` |
| *Too many login attempts* | 10 failures in 15 min | Wait 15 min or restart the backend (dev) |
| Page shows *Access denied* | Your role lacks that permission | Log in as an admin |
| Secure link shows *Link no longer valid* | Expired (72h by default) or revoked | Open it from Submissions; an admin can **Generate new link** |
| Secure link shows *Access denied* | Submission belongs to a hospital you can't access | An admin adds the hospital to your account |
| Submission listed as *(unassigned)* | Form hospital name didn't match a hospital | Super Admin → open it → **Edit details** → choose hospital |
| Frontend: *Request failed with status code 500* on every page | Backend not running | Start `npm run dev` or `npm run dev:local` |
| `npm run dev` exits: *Could not connect to the database* | `DATABASE_URL` empty/wrong, or project paused | See PHASE-2.md → Common errors |
