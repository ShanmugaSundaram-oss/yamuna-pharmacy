// ============================================================
// MediCare POS — Google Apps Script Backend
// Deploy as: Web App → Execute as: Me → Who has access: Anyone
// ============================================================

const SHEET_MEDICINES = 'Medicines';
const SHEET_BILLS     = 'Bills';
const SHEET_SETTINGS  = 'Settings';

// ── Helpers ──────────────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheet(sheet, name);
  }
  return sheet;
}

function initSheet(sheet, name) {
  if (name === SHEET_MEDICINES) {
    sheet.appendRow(['id','name','generic','manufacturer','category','stock','unit',
                     'mrp','costPrice','gst','batch','expiry','hsn','createdAt','updatedAt']);
  } else if (name === SHEET_BILLS) {
    sheet.appendRow(['id','billNo','patientName','doctorName','items','subtotal',
                     'discountAmt','taxAmt','grandTotal','paymentMode','createdAt']);
  } else if (name === SHEET_SETTINGS) {
    sheet.appendRow(['key','value']);
  }
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateId() {
  return Utilities.getUuid();
}

// ── GET Handler ───────────────────────────────────────────────

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getMedicines') {
      return jsonResponse({ ok: true, data: sheetToObjects(getSheet(SHEET_MEDICINES)) });
    }
    if (action === 'getBills') {
      const bills = sheetToObjects(getSheet(SHEET_BILLS)).map(b => {
        try { b.items = JSON.parse(b.items); } catch(_) { b.items = []; }
        return b;
      });
      return jsonResponse({ ok: true, data: bills });
    }
    if (action === 'getSettings') {
      const rows = sheetToObjects(getSheet(SHEET_SETTINGS));
      const settings = {};
      rows.forEach(r => { settings[r.key] = r.value; });
      return jsonResponse({ ok: true, data: settings });
    }
    return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
  } catch(err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

// ── POST Handler ──────────────────────────────────────────────

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    // ── Medicines ──
    if (action === 'addMedicine') {
      const sheet = getSheet(SHEET_MEDICINES);
      const now = new Date().toISOString();
      const id = generateId();
      const d = body.data;
      sheet.appendRow([id, d.name, d.generic||'', d.manufacturer||'', d.category||'',
                       d.stock||0, d.unit||'Strip', d.mrp||0, d.costPrice||0, d.gst||0,
                       d.batch||'', d.expiry||'', d.hsn||'', now, now]);
      return jsonResponse({ ok: true, id });
    }

    if (action === 'updateMedicine') {
      const sheet = getSheet(SHEET_MEDICINES);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idCol = headers.indexOf('id');
      for (let i = 1; i < data.length; i++) {
        if (data[i][idCol] === body.id) {
          const d = body.data;
          const now = new Date().toISOString();
          const updatedAt = headers.indexOf('updatedAt');
          const fields = { name:d.name, generic:d.generic, manufacturer:d.manufacturer,
                           category:d.category, stock:d.stock, unit:d.unit, mrp:d.mrp,
                           costPrice:d.costPrice, gst:d.gst, batch:d.batch, expiry:d.expiry,
                           hsn:d.hsn };
          Object.entries(fields).forEach(([k, v]) => {
            const col = headers.indexOf(k);
            if (col >= 0 && v !== undefined) sheet.getRange(i+1, col+1).setValue(v);
          });
          if (updatedAt >= 0) sheet.getRange(i+1, updatedAt+1).setValue(now);
          return jsonResponse({ ok: true });
        }
      }
      return jsonResponse({ ok: false, error: 'Medicine not found' });
    }

    if (action === 'deleteMedicine') {
      const sheet = getSheet(SHEET_MEDICINES);
      const data = sheet.getDataRange().getValues();
      const idCol = data[0].indexOf('id');
      for (let i = 1; i < data.length; i++) {
        if (data[i][idCol] === body.id) {
          sheet.deleteRow(i + 1);
          return jsonResponse({ ok: true });
        }
      }
      return jsonResponse({ ok: false, error: 'Medicine not found' });
    }

    // ── Bills ──
    if (action === 'saveBill') {
      const sheet = getSheet(SHEET_BILLS);
      const d = body.data;
      const id = d.id || generateId();
      sheet.appendRow([id, d.billNo||'', d.patientName||'', d.doctorName||'',
                       JSON.stringify(d.items||[]), d.subtotal||0, d.discountAmt||0,
                       d.taxAmt||0, d.grandTotal||0, d.paymentMode||'Cash',
                       d.createdAt || new Date().toISOString()]);
      return jsonResponse({ ok: true, id });
    }

    // ── Settings ──
    if (action === 'saveSettings') {
      const sheet = getSheet(SHEET_SETTINGS);
      const data = sheet.getDataRange().getValues();
      const settings = body.data;
      Object.entries(settings).forEach(([key, value]) => {
        let found = false;
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === key) {
            sheet.getRange(i+1, 2).setValue(value);
            found = true; break;
          }
        }
        if (!found) sheet.appendRow([key, value]);
      });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
  } catch(err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}
