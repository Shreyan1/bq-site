// Builders' Quorum seat requests: receives the form on waitlist.html and adds each request
// as a row in this Google Sheet. It is not part of the published site.
//
// Setup, once (about five minutes). It works from Drive or from inside a sheet:
// 1. In the BQ Google account, open script.google.com (or Drive > New > More > Google Apps
//    Script) and start a new project. Name it "BQ seat requests".
//    From inside a sheet instead: Extensions > Apps Script. That menu only appears in a
//    native Google Sheet, not in an .xlsx file opened in Sheets (File > Save as Google
//    Sheets first).
// 2. Replace everything in Code.gs with this file and save (Cmd+S). The function menu says
//    "No functions" until the file is saved.
// 3. Choose setup in the function menu, press Run and accept the permissions. From Drive it
//    creates a sheet called "BQ seat requests" in your Drive; from a sheet it uses that
//    sheet. Either way it adds the Requests and Summary tabs, and the Execution log prints
//    the sheet's address.
// 4. Deploy > New deployment > type Web app. Execute as: Me. Who has access: Anyone. Deploy,
//    then copy the web app address (it ends in /exec). Open it in a browser: it should say
//    {"ok":true,...}.
// 5. Paste that address into WAITLIST_ENDPOINT at the top of website/main.js and push.
//
// To use a sheet that already exists, paste its ID (the part of its address between /d/ and
// /edit) into SHEET_ID below before running setup.
//
// After changing this file: Deploy > Manage deployments > Edit > Version: New version.
// Otherwise the live address keeps running the old code.
//
// Only the founders should have access to the sheet. Share it with them, nobody else.

const NOTIFY = ''; // an address to email on each request, for example hello@buildersquorum.com, or '' for none
const SHEET_ID = ''; // optional: an existing sheet to write to. Leave empty and setup makes one

// [form field, column heading]. The order here is the column order in the sheet. Status and
// Notes are left empty for the founders to fill in while they choose each room.
const FIELDS = [
  ['submitted_at', 'Submitted'],
  ['name', 'Name'],
  ['email', 'Email'],
  ['whatsapp', 'WhatsApp'],
  ['linkedin', 'LinkedIn'],
  ['role', 'Current role'],
  ['organisation', 'Company or university'],
  ['experience', 'Experience'],
  ['working_on', 'Working on'],
  ['areas', 'Frontier areas'],
  ['problem', 'Problem they would bring'],
  ['area', 'Area'],
  ['day', 'Day'],
  ['time', 'Time'],
  ['topics', 'Topics (two)'],
  ['confirm_choice', 'How they would confirm'],
  ['heard_from', 'Heard about us'],
  ['sent_by', 'Sent by'],
  ['contact_ok', 'Contact consent'],
  ['ref_code', 'Their code'],
  ['referred_by', 'Came through code'],
  ['utm_source', 'utm_source'],
  ['utm_medium', 'utm_medium'],
  ['utm_campaign', 'utm_campaign'],
  ['landing_referrer', 'Referrer'],
  ['repeat', 'Repeat email'],
  ['status', 'Status'],
  ['notes', 'Notes'],
];
const STATUSES = ['New', 'Shortlisted', 'Invited', 'Confirmed', 'Waitlist', 'Declined'];

// Columns the Summary tab counts. Lists (areas, topics) are split before counting.
const SUMMARY = ['area', 'day', 'time', 'topics', 'areas', 'confirm_choice', 'role', 'experience', 'heard_from', 'utm_source', 'referred_by'];

function doPost(e) {
  const p = e.parameters; // every value is a list, so ticked boxes arrive together
  if (first(p.botcheck)) return reply({ ok: true }); // only bots tick the hidden box
  if (!first(p.email) || !first(p.name)) return reply({ ok: false, error: 'Missing name or email' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = requests();
    const email = first(p.email).trim().toLowerCase();
    const last = sheet.getLastRow();
    const emails = last > 1 ? sheet.getRange(2, column('email'), last - 1, 1).getValues() : [];
    const repeat = emails.some(([value]) => String(value).trim().toLowerCase() === email);

    sheet.appendRow(FIELDS.map(([key]) => {
      if (key === 'submitted_at') return new Date();
      if (key === 'repeat') return repeat ? 'Yes' : '';
      if (key === 'status') return 'New';
      return safe((p[key] || []).join('; '));
    }));
  } finally {
    lock.releaseLock();
  }

  if (NOTIFY) {
    MailApp.sendEmail(NOTIFY, `BQ seat request: ${first(p.name)}`,
      FIELDS.filter(([key]) => p[key]).map(([key, label]) => `${label}: ${p[key].join('; ')}`).join('\n'));
  }
  return reply({ ok: true });
}

// Opening the web app address in a browser shows it is running.
function doGet() {
  return reply({ ok: true, service: 'BQ seat requests' });
}

// Run once from the editor. Safe to run again: it rebuilds the Summary tab and leaves the rows alone.
function setup() {
  const sheet = requests();
  const status = sheet.getRange(2, column('status'), sheet.getMaxRows() - 1, 1);
  status.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());

  const book = spreadsheet();
  const summary = book.getSheetByName('Summary') || book.insertSheet('Summary');
  summary.clear();
  summary.getRange('A1').setValue('Requests').setFontWeight('bold');
  summary.getRange('A2').setFormula('=COUNTA(Requests!B2:B)');
  summary.getRange('B1').setValue('Different people').setFontWeight('bold');
  summary.getRange('B2').setFormula('=COUNTUNIQUE(Requests!C2:C)');

  // One block per question, side by side from row 4: each answer and how many chose it.
  SUMMARY.forEach((key, i) => {
    const col = 1 + i * 3;
    const letter = columnLetter(column(key));
    const range = `Requests!${letter}2:${letter}`;
    summary.getRange(4, col).setValue(FIELDS.find(([k]) => k === key)[1]).setFontWeight('bold');
    summary.getRange(5, col).setFormula(
      `=IFERROR(QUERY(FLATTEN(ARRAYFORMULA(IFERROR(SPLIT(${range}, "; ", FALSE)))), ` +
      `"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label count(Col1) ''", 0), "None yet")`);
  });
  summary.setFrozenRows(4);
  Logger.log(`Requests are saved to ${book.getUrl()}`);
}

// The sheet the requests go to. A script made inside a sheet uses that sheet. A script made
// from Drive has no sheet of its own (getActiveSpreadsheet() is null there), so it uses
// SHEET_ID, or the sheet it created on its first run, whose ID it keeps in Script Properties.
function spreadsheet() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const created = SpreadsheetApp.create('BQ seat requests');
  props.setProperty('SHEET_ID', created.getId());
  return created;
}

function requests() {
  const book = spreadsheet();
  let sheet = book.getSheetByName('Requests');
  if (!sheet) {
    sheet = book.getSheets()[0];
    sheet.setName('Requests');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(FIELDS.map(([, label]) => label));
    sheet.getRange(1, 1, 1, FIELDS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function column(key) {
  return FIELDS.findIndex(([k]) => k === key) + 1;
}

function columnLetter(n) {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function first(list) {
  return list && list.length ? String(list[0]) : '';
}

// A value starting with = + - or @ would be read as a formula (a WhatsApp number starting
// with + included), so it is stored as plain text.
function safe(value) {
  const text = String(value).slice(0, 2000);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
