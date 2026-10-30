/**
 * Google Form → Supabase → shareable link.
 *
 * Paste this into the Google SHEET linked to your form (Extensions → Apps Script),
 * then run setupTrigger() once. After that, every form submission:
 *   1. is saved to Supabase,
 *   2. gets a unique link, written into a "Link" column in the same row.
 */

// Public values: safe to keep in code (the database only allows the two functions below).
var SUPABASE_URL = 'https://xpeanpkcggyzssienxwr.supabase.co';
var SUPABASE_KEY = 'sb_publishable_WRgqwQbpJsE9yjoEYmwJWg_7lDECSe8';
var VIEW_PAGE_URL = 'https://vuday3336.github.io/Automation-Form-LinkGeneration/';

var LINK_COLUMN = 'Link';

/** Runs automatically on every form submission (after setupTrigger). */
function onFormSubmitHandler(e) {
  processRow_(e.range.getSheet(), e.range.getRow());
}

/** Run once from the editor: installs the form-submit trigger. */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onFormSubmitHandler') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onFormSubmitHandler').forSpreadsheet(SpreadsheetApp.getActive()).onFormSubmit().create();
  Logger.log('Trigger installed. Submit the form to test.');
}

/** Optional: creates links for responses that came in before the script was installed. */
function linkExistingRows() {
  var sheet = getResponsesSheet_();
  for (var row = 2; row <= sheet.getLastRow(); row++) processRow_(sheet, row);
}

function processRow_(sheet, row) {
  var linkCol = ensureLinkColumn_(sheet);
  var linkCell = sheet.getRange(row, linkCol);
  if (linkCell.getValue()) return; // already has a link

  var width = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  var values = sheet.getRange(row, 1, 1, width).getValues()[0];

  // Every column becomes a question/answer pair, so any form layout works.
  var answers = [];
  for (var i = 0; i < width; i++) {
    var question = String(headers[i]).trim();
    if (!question || question === LINK_COLUMN) continue;
    var value = values[i];
    if (value instanceof Date) value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    answers.push({ question: question, answer: String(value) });
  }

  var response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/create_submission', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SUPABASE_KEY },
    payload: JSON.stringify({
      p_answers: answers,
      p_response_key: sheet.getParent().getId() + ':' + sheet.getSheetId() + ':' + row,
      p_form_title: sheet.getParent().getName()
    }),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    linkCell.setValue('ERROR: ' + response.getContentText().slice(0, 200));
    throw new Error('Supabase returned HTTP ' + response.getResponseCode() + ': ' + response.getContentText());
  }

  var token = JSON.parse(response.getContentText());
  linkCell.setValue(VIEW_PAGE_URL + '?id=' + token);
  Logger.log('Row ' + row + ' → ' + VIEW_PAGE_URL + '?id=' + token);
}

function ensureLinkColumn_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var index = headers.indexOf(LINK_COLUMN);
  if (index !== -1) return index + 1;
  var col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(LINK_COLUMN).setFontWeight('bold');
  return col;
}

function getResponsesSheet_() {
  var sheets = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < sheets.length; i++) if (sheets[i].getFormUrl()) return sheets[i];
  return SpreadsheetApp.getActiveSheet();
}
