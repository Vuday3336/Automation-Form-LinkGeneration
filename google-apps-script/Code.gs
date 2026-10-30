/**
 * HospitalForm AI: Google Sheets → backend integration.
 *
 * Paste this whole file into the Apps Script editor of the Google SHEET that receives your
 * form responses (Extensions → Apps Script). See README.md in this folder for the full guide.
 *
 * Flow for every new form response:
 *   1. Google adds a row to the "Form Responses" sheet and fires our installable trigger.
 *   2. We read that row + the header row (= the questions), so any form layout works.
 *   3. We build a JSON payload with a stable sourceResponseId and POST it to the backend
 *      with the shared secret in the X-Integration-Secret header.
 *   4. The backend returns a Submission ID and a secure link; we write both into the row.
 *
 * Required Script Properties (Project Settings → Script Properties):
 *   BACKEND_URL         e.g. https://your-api.example.com/api/integrations/google-form/submissions
 *   INTEGRATION_SECRET  the same value as INTEGRATION_SECRET in backend/.env
 */

// Columns this script adds to the right of the form's columns. They're ignored when reading answers.
var OUTPUT_COLUMNS = ['Submission ID', 'Secure Link', 'Sync Status'];
var MAX_ATTEMPTS = 3;

// ─── Trigger entry point ─────────────────────────────────────────────────────

/** Runs automatically on every form submission (installable trigger, see setupTrigger). */
function onFormSubmitHandler(e) {
  if (!e || !e.range) {
    throw new Error('onFormSubmitHandler must be run by the form-submit trigger. Use testWithSamplePayload() to test manually.');
  }
  processRow_(e.range.getSheet(), e.range.getRow());
}

// ─── One-time setup helpers (run manually from the editor) ───────────────────

/** Creates the installable "On form submit" trigger. Safe to run more than once. */
function setupTrigger() {
  var spreadsheet = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'onFormSubmitHandler') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('onFormSubmitHandler').forSpreadsheet(spreadsheet).onFormSubmit().create();
  Logger.log('Trigger installed for spreadsheet: ' + spreadsheet.getName());
}

/** Checks Script Properties and that the backend answers (without printing the secret). */
function checkConfiguration() {
  var config = getConfig_();
  Logger.log('BACKEND_URL: ' + config.backendUrl);
  Logger.log('INTEGRATION_SECRET: set (' + config.secret.length + ' characters)');
  var healthUrl = config.backendUrl.replace(/\/api\/.*$/, '/api/health');
  var response = UrlFetchApp.fetch(healthUrl, { muteHttpExceptions: true });
  Logger.log('Backend health: HTTP ' + response.getResponseCode() + ' ' + response.getContentText());
}

/** Sends a dummy payload to the backend without submitting the form. */
function testWithSamplePayload() {
  var payload = {
    source: 'google_form',
    sourceResponseId: 'apps-script-test-' + Utilities.getUuid(),
    formId: 'apps-script-test',
    formTitle: 'Apps Script Test',
    submittedAt: new Date().toISOString(),
    respondentEmail: null,
    answers: [
      { question: 'Hospital Name', answer: 'Demo City General Hospital' },
      { question: 'Department', answer: 'Radiology' },
      { question: 'Submission Type', answer: 'Equipment Request' },
      { question: 'Patient Name', answer: 'Test Patient Echo' },
      { question: 'Request Details', answer: 'Dummy request sent from testWithSamplePayload().' }
    ]
  };
  var result = sendToBackend_(payload);
  Logger.log(JSON.stringify(result, null, 2));
}

/** Re-sends every row whose Sync Status starts with "FAILED" (e.g. after the backend was down). */
function retryFailedRows() {
  var sheet = getResponsesSheet_();
  var columns = ensureOutputColumns_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var statuses = sheet.getRange(2, columns['Sync Status'], lastRow - 1, 1).getValues();
  for (var i = 0; i < statuses.length; i++) {
    if (String(statuses[i][0]).indexOf('FAILED') === 0) processRow_(sheet, i + 2);
  }
}

// ─── Core logic ──────────────────────────────────────────────────────────────

function processRow_(sheet, row) {
  // A lock stops two trigger runs from processing the same row at the same time.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Could not obtain lock; another run is in progress');

  try {
    var columns = ensureOutputColumns_(sheet);
    var idCell = sheet.getRange(row, columns['Submission ID']);
    if (idCell.getValue()) {
      Logger.log('Row ' + row + ' already synced as ' + idCell.getValue() + '; skipping');
      return;
    }

    var payload = buildPayload_(sheet, row);
    var statusCell = sheet.getRange(row, columns['Sync Status']);
    try {
      var result = sendToBackend_(payload);
      idCell.setValue(result.data.submissionId);
      if (result.data.secureUrl) sheet.getRange(row, columns['Secure Link']).setValue(result.data.secureUrl);
      statusCell.setValue(result.data.duplicate ? 'OK (duplicate)' : 'OK');
      Logger.log('Row ' + row + ' synced: ' + result.data.submissionId);
    } catch (err) {
      statusCell.setValue('FAILED: ' + String(err.message).slice(0, 200) + ' (' + new Date().toISOString() + ')');
      Logger.log('Row ' + row + ' failed: ' + err.message);
      throw err; // also show the failure in the Executions log
    }
  } finally {
    lock.releaseLock();
  }
}

/** Turns one sheet row into the JSON payload. Works for any set of questions. */
function buildPayload_(sheet, row) {
  // Read the full width: if questions are added to the form later, Google appends their
  // columns AFTER our output columns, so we skip output columns by name instead.
  var width = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  var values = sheet.getRange(row, 1, 1, width).getValues()[0];

  var timestamp = values[0] instanceof Date ? values[0] : new Date();
  var answers = [];
  var respondentEmail = null;

  for (var i = 1; i < headers.length; i++) {
    var question = String(headers[i]).trim();
    var value = values[i];
    if (!question || OUTPUT_COLUMNS.indexOf(question) !== -1) continue;
    if (question === 'Email Address') {
      respondentEmail = value ? String(value) : null;
      continue;
    }
    if (value instanceof Date) value = value.toISOString();
    if (value === '' || value === null) value = null;
    answers.push({ question: question, answer: value === null ? null : String(value) });
  }

  return {
    source: 'google_form',
    // Stable ID: the same row always produces the same ID, so if Google fires the trigger
    // twice the backend recognises the duplicate.
    sourceResponseId: stableResponseId_(sheet, row, timestamp),
    formId: getFormId_(sheet),
    formTitle: sheet.getParent().getName(),
    submittedAt: timestamp.toISOString(),
    respondentEmail: respondentEmail,
    answers: answers
  };
}

/** POSTs to the backend, retrying temporary failures (network errors, 429, 5xx). */
function sendToBackend_(payload) {
  var config = getConfig_();
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Integration-Secret': config.secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var lastError;
  for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      var response = UrlFetchApp.fetch(config.backendUrl, options);
      var code = response.getResponseCode();
      var body = parseJson_(response.getContentText());

      if (code === 200 || code === 201) return body;
      var message = 'HTTP ' + code + ': ' + (body && body.message ? body.message : 'unexpected response');
      if (body && body.errors) message += ' ' + JSON.stringify(body.errors);

      // 4xx (except 429) means the request itself is wrong: retrying won't help.
      if (code < 500 && code !== 429) throw new PermanentError_(message);
      lastError = new Error(message);
    } catch (err) {
      if (err instanceof PermanentError_) throw new Error(err.message);
      lastError = err;
    }
    if (attempt < MAX_ATTEMPTS) Utilities.sleep(1000 * Math.pow(2, attempt - 1)); // 1s, 2s
  }
  throw new Error('Backend unreachable after ' + MAX_ATTEMPTS + ' attempts: ' + lastError.message);
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function PermanentError_(message) {
  this.message = message;
}

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  var backendUrl = props.getProperty('BACKEND_URL');
  var secret = props.getProperty('INTEGRATION_SECRET');
  if (!backendUrl || !/^https:\/\//.test(backendUrl)) {
    throw new Error('Script Property BACKEND_URL is missing or not https://');
  }
  if (!secret || secret.length < 32) throw new Error('Script Property INTEGRATION_SECRET is missing or too short');
  return { backendUrl: backendUrl, secret: secret };
}

function getResponsesSheet_() {
  var sheets = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getFormUrl()) return sheets[i];
  }
  throw new Error('No sheet in this spreadsheet is linked to a Google Form');
}

/** Adds the output columns once (after the form's columns) and returns their positions. */
function ensureOutputColumns_(sheet) {
  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var positions = {};
  OUTPUT_COLUMNS.forEach(function (name) {
    var index = headers.indexOf(name);
    if (index === -1) {
      lastColumn += 1;
      sheet.getRange(1, lastColumn).setValue(name).setFontWeight('bold');
      index = lastColumn - 1;
    }
    positions[name] = index + 1;
  });
  return positions;
}

function stableResponseId_(sheet, row, timestamp) {
  var raw = sheet.getParent().getId() + ':' + sheet.getSheetId() + ':' + row + ':' + timestamp.getTime();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return 'gs-' + digest.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 40);
}

function getFormId_(sheet) {
  var url = sheet.getFormUrl();
  var match = url && url.match(/\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function parseJson_(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}
