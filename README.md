# Automation Form → Link Generation (demo)

Fill in the Google Form → the answers are saved in Supabase → a unique link to view them
appears in the response sheet.

```
Google Form ─► Google Sheet ─► Apps Script (on submit) ─► Supabase
                    ▲                                        │
                    └──────── "Link" column ◄── token ───────┘
Link ─► index.html (GitHub Pages) ─► reads the answers from Supabase ─► shows them
```

> Demo only: anyone with a link can view that submission. Use dummy data.

## Files

| File | What it does |
|---|---|
| `apps-script/Code.gs` | Runs on each form submit: sends the answers to Supabase, writes the link back to the sheet |
| `index.html` | The page the link opens: shows the questions and answers |
| `supabase/schema.sql` | The database table and two functions (already applied to the Supabase project) |

## Setup (one time)

1. **Turn on GitHub Pages:** in this repo on GitHub, go to **Settings → Pages**. Under *Build and
   deployment*, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
   After about a minute the page is live at https://vuday3336.github.io/Automation-Form-LinkGeneration/
2. **Link the form to a sheet:** in your Google Form, open **Responses → Link to Sheets → Create**.
3. **Add the script:** in that spreadsheet, open **Extensions → Apps Script**, replace everything with
   `apps-script/Code.gs`, and click **Save**.
4. **Turn on the automation:** in the function dropdown pick **`setupTrigger`**, click **Run**, then
   **Review permissions → your account → Advanced → Go to project → Allow**.

## Use it

Submit the form. Within a few seconds the response row gets a **Link** cell. Open it to see the answers.

- Responses submitted before step 4: run **`linkExistingRows`** once to give them links too.
- Something went wrong: the Link cell shows `ERROR: …`, and **Executions** in the Apps Script
  editor shows the full log.

## How it stays safe enough for a demo

- The Supabase table is locked: the public key can only call `create_submission` (save answers and get a
  token) and `get_submission` (read one submission by its token).
- Tokens are 64 random hex characters, so links can't be guessed or listed.
- Re-running the script for the same row returns the same link instead of creating a duplicate.
