# Google Forms → HospitalForm AI (Apps Script)

`Code.gs` runs inside Google's servers, attached to the Google **Sheet** that collects your form
responses. Every time someone submits the form, it sends the answers to your backend and writes
the Submission ID and secure link back into the sheet.

> Use dummy data only. Never put real patient information into a test form.

## What is what

- **Google Apps Script**: JavaScript that runs on Google's servers, with access to your Sheets/Forms.
- **Trigger**: a rule that runs a function automatically. We use an *installable* "On form submit"
  trigger. Unlike a simple trigger, it is allowed to call external URLs (`UrlFetchApp`).
- **Script Properties**: a private key/value store for the script, where we keep the backend URL and the
  shared secret, so they're never written in the code.
- **Webhook**: what this script effectively is: "when X happens, POST the data to a URL".

## 1. Create the form (dummy questions)

1. Go to https://forms.google.com → **Blank form**. Title: `Hospital Operations Request (Demo)`.
2. Add questions. The backend recognises these titles (case doesn't matter):

   | Purpose | Accepted question titles | Required? |
   |---|---|---|
   | Hospital | `Hospital Name`, `Hospital`, `Facility`, `Facility Name` | **Yes** |
   | Department | `Department`, `Dept`, `Ward`, `Unit` | No |
   | Submission type | `Submission Type`, `Request Type`, `Type of Request`, `Category` | No |
   | Patient name | `Patient Name`, `Patient`, `Patient Full Name` | No (stored encrypted, hidden from Viewers) |

   Add any other questions you like (`Priority`, `Request Details`, checkboxes...). They're all stored.
3. For **Hospital Name**, a *Dropdown* with the exact names avoids typos:
   `Demo City General Hospital`, `Sample Valley Medical Center`, `Test River Children Hospital`.
   Names the backend doesn't recognise are stored as *Unassigned* (visible to Super Admins, who can
   assign them a hospital).

## 2. Connect it to Google Sheets

In the form: **Responses** tab → **Link to Sheets** → *Create a new spreadsheet* → **Create**.
Each response now becomes a row; row 1 holds the questions.

## 3. Open Apps Script and paste the code

In the **spreadsheet** (not the form): **Extensions → Apps Script**. Delete the sample code in `Code.gs`,
paste the entire contents of this folder's `Code.gs`, click **Save** (💾).

## 4. Configure Script Properties

Apps Script editor → ⚙️ **Project Settings** → **Script Properties** → **Add script property**:

| Property | Value |
|---|---|
| `BACKEND_URL` | `https://<your-public-api>/api/integrations/google-form/submissions` |
| `INTEGRATION_SECRET` | the same value as `INTEGRATION_SECRET` in `backend/.env` |

**Your backend must be reachable from the internet over HTTPS.** Google's servers can't reach
`localhost`. While developing, use a tunnel (run it from the `backend/` machine while `npm run dev` is running):

```bash
npx cloudflared tunnel --url http://localhost:5000
```

It prints a `https://....trycloudflare.com` address; use that as the start of `BACKEND_URL` (it changes
each time you restart the tunnel). After deployment (Phase 10) use your real API URL.

## 5. Grant permissions and create the trigger

1. In the editor's function dropdown choose **`setupTrigger`** → **Run**.
2. Google asks for authorization: **Review permissions** → choose your account → *Advanced* →
   *Go to (project name)* → **Allow**. The script asks for:
   - *View and manage spreadsheets*: read the response row, write the link back
   - *Connect to an external service*: call your backend
   - *Allow this application to run when you are not present*: the trigger
3. Check ⏰ **Triggers** (left sidebar): you should see `onFormSubmitHandler`, *From spreadsheet*, *On form submit*.

## 6. Test it

1. Run **`checkConfiguration`**. The log should show `Backend health: HTTP 200 ...`.
2. Run **`testWithSamplePayload`**. The log shows `"success": true` and a `secureUrl`. The submission
   appears in the dashboard.
3. Submit the real form (open it via *Preview* 👁). Within a few seconds the response row gets
   **Submission ID**, **Secure Link**, **Sync Status = OK** columns.
4. Open the secure link: you're asked to log in, then you see the submission.

## 7. Read the logs

Apps Script editor → **Executions** (left sidebar). Each trigger run is listed with its status;
click one to see the `Logger.log` lines (e.g. `Row 5 synced: HF-20261030-7K3QX9PA`).

## How it avoids duplicates and handles failures

- **Stable ID**: `sourceResponseId` is a hash of spreadsheet + sheet + row + timestamp, so re-running
  for the same row always sends the same ID, and the backend's unique constraint ignores the copy.
- **Sheet marker + lock**: a row with a Submission ID is skipped; `LockService` stops two runs
  processing the same row at once.
- **Retries**: network errors, HTTP 429 and 5xx are retried 3 times (1s, 2s back-off). 4xx errors
  (bad secret, invalid data) aren't retried; the row is marked `FAILED: <reason>`.
- **Recovery**: after fixing the problem, run **`retryFailedRows`** to resend every failed row.

## Common errors

| Sync Status / log | Meaning | Fix |
|---|---|---|
| `Script Property BACKEND_URL is missing or not https://` | Property not set | Step 4 |
| `HTTP 401: Invalid integration secret` | Secret differs from backend `.env` | Copy it again exactly (no spaces) |
| `HTTP 400: Validation failed ... No hospital answer found` | No hospital question | Add a `Hospital Name` question |
| `Backend unreachable after 3 attempts: ... DNS / timeout` | Tunnel stopped or URL changed | Restart the tunnel, update `BACKEND_URL`, run `retryFailedRows` |
| Nothing happens on submit | Trigger missing | Run `setupTrigger` again; check ⏰ Triggers |
| `Exception: You do not have permission to call UrlFetchApp.fetch` | Authorization not granted | Run `setupTrigger` and accept permissions |
