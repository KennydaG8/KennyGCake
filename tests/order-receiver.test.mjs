// Runs order-backend/Code.gs with stand-ins for the Google services.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SECRET = "s".repeat(40);
function receiver({ secret = SECRET, mailFails = false } = {}) {
  const rows = [], mails = [];
  const sheet = {
    appendRow: (r) => rows.push(r),
    setFrozenRows() {},
    getLastRow: () => rows.length,
    getRange: (r, c, n) => ({ getValues: () => rows.slice(r - 1, r - 1 + n).map((x) => [x[c - 1]]) }),
  };
  rows.push(["訂單編號"]);
  const ss = { getSheetByName: () => sheet, getUrl: () => "url" };
  const context = vm.createContext({
    console: { error() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => secret }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => "261125-190000", sleep() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    MailApp: { sendEmail: (m) => { if (mailFails) throw new Error("quota"); mails.push(m); } },
    Session: { getEffectiveUser: () => ({ getEmail: () => "x" }) },
    ContentService: { createTextOutput: (t) => ({ setMimeType: () => t }), MimeType: {} },
  });
  vm.runInContext(fs.readFileSync(new URL("../order-backend/Code.gs", import.meta.url), "utf8"), context);
  return { rows, mails, post: (d) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(d) } })) };
}
const base = { companyCode: "bigdata", companyName: "大數據", name: "測試", phone: "0912345678", date: "2026-12-01", slot: "10:00–12:00", address: "x", items: [{ id: "original", quantity: 12, unitPrice: 76 }] };
const paid = { ...base, paidSecret: SECRET, orderId: "KGC-1", totalAmount: 912 };

test("a paid order is recorded and mailed once even if it is sent twice", () => {
  const r = receiver();
  assert.deepEqual(r.post(paid), { ok: true, paid: true, orderId: "KGC-1" });
  assert.equal(r.post(paid).duplicate, true);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[1].at(-1), "已付款 LINE Pay");
  assert.equal(r.rows[1][13], 912);
  assert.equal(r.mails.length, 1);
  assert.match(r.mails[0].subject, /已付款/);
});

test("nobody can claim an order is paid without the secret", () => {
  for (const options of [{}, { secret: null }, { secret: "short" }]) {
    const r = receiver(options);
    assert.equal(r.post({ ...paid, paidSecret: "short" }).error, "FORBIDDEN");
    assert.equal(r.rows.length, 1);
    assert.equal(r.mails.length, 0);
  }
  const r = receiver();
  r.post({ ...base, payment: "已付款", status: "已付款", totalAmount: 1 });
  assert.equal(r.rows[1].at(-1), "新訂單");
  assert.equal(r.rows[1][13], 912);
});

test("cash orders are marked for collection on delivery", () => {
  const r = receiver();
  assert.equal(r.post({ ...base, payment: "CASH" }).paid, false);
  assert.equal(r.rows[1].at(-1), "現場收現金");
  assert.equal(r.post({ ...base, items: [{ id: "original", quantity: 11 }] }).error, "BELOW_MINIMUM");
});

test("customer text is never a formula and a mail failure does not lose the order", () => {
  const r = receiver({ mailFails: true });
  assert.equal(r.post({ ...paid, note: "=IMPORTXML(1)" }).ok, true);
  assert.equal(r.rows[1][17], "'=IMPORTXML(1)");
});
