/**
 * KennyG Cake 企業同仁訂單收件器 (Google Apps Script)
 * Each order from https://kennygcake.com/order/ is added to the bound sheet
 * and emailed to the account that deploys this script.
 * No email address is hard-coded: it uses the deploying Google account.
 */

// Set when the script is standalone (not opened from the sheet). Empty = use the bound sheet.
const SPREADSHEET_ID = '';
const SHEET_NAME = '企業訂單';
const MIN_QTY = 12;
const DEFAULT_UNIT_PRICE = 76;
const UNIT_PRICES = {}; // per-company override, e.g. { somecorp: 70 }
const PRODUCTS = { original: '原味', matcha: '抹茶', chocolate: '巧克力' };
const HEADERS = ['訂單編號', '下單時間', '公司代碼', '公司', '姓名', '手機', '部門/分機', 'Email',
  '原味', '抹茶', '巧克力', '總顆數', '單價', '金額', '送達日期', '時段', '送達地點', '備註', '狀態'];

function doGet() {
  return json_({ ok: true, service: 'kennygcake-company-order' });
}

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return json_({ ok: true, orderId: 'IGNORED' }); // honeypot filled = bot

    // Only the LINE Pay Worker knows PAID_SECRET (script property). Anyone can post to this URL,
    // so an order counts as paid only with the right secret.
    const secret = PropertiesService.getScriptProperties().getProperty('PAID_SECRET');
    const paid = Boolean(d.paidSecret);
    if (paid && (!secret || secret.length < 32 || d.paidSecret !== secret)) return json_({ ok: false, error: 'FORBIDDEN' });

    const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
    const cell = (v, max) => str(v, max).replace(/^([=+\-@])/, "'$1"); // never run customer text as a formula
    const companyCode = str(d.companyCode, 40).toLowerCase();
    const companyName = str(d.companyName, 80);
    const name = str(d.name, 40);
    const phone = str(d.phone, 20);
    const date = str(d.date, 10);
    const address = str(d.address, 120);
    if (!companyCode || !name || !/^[0-9+\-\s()]{8,20}$/.test(phone) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !address) {
      return json_({ ok: false, error: 'MISSING_FIELDS' });
    }

    const qty = { original: 0, matcha: 0, chocolate: 0 };
    (Array.isArray(d.items) ? d.items : []).forEach(function (i) {
      if (Object.prototype.hasOwnProperty.call(qty, i.id)) {
        qty[i.id] = Math.max(0, Math.min(200, Math.floor(Number(i.quantity) || 0)));
      }
    });
    const totalQty = qty.original + qty.matcha + qty.chocolate;
    if (!paid && totalQty < MIN_QTY) return json_({ ok: false, error: 'BELOW_MINIMUM' });

    // Unpaid orders: prices are recalculated here; the page's numbers are not trusted.
    // Paid orders: the Worker sends the amount LINE Pay really charged.
    const unitPrice = paid ? Number((d.items[0] || {}).unitPrice) || 0 : (UNIT_PRICES[companyCode] || DEFAULT_UNIT_PRICE);
    const amount = paid ? Number(d.totalAmount) || 0 : totalQty * unitPrice;
    const status = paid ? '已付款 LINE Pay' : (d.payment === 'CASH' ? '現場收現金' : '新訂單');

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let orderId;
    try {
      const now = new Date();
      orderId = paid ? str(d.orderId, 40) : 'KG' + Utilities.formatDate(now, 'Asia/Taipei', 'yyMMdd-HHmmss');
      const sheet = sheet_();
      if (paid) {
        // The Worker retries until it hears back, so the same order can arrive twice.
        const last = sheet.getLastRow();
        const ids = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues() : [];
        if (!orderId) return json_({ ok: false, error: 'MISSING_FIELDS' });
        if (ids.some(function (r) { return r[0] === orderId; })) return json_({ ok: true, paid: true, orderId: orderId, duplicate: true });
      }
      sheet.appendRow([orderId, Utilities.formatDate(now, 'Asia/Taipei', 'yyyy-MM-dd HH:mm'), cell(companyCode, 40), cell(companyName, 80),
        cell(name, 40), "'" + phone, cell(d.department, 60), cell(d.email, 120), qty.original, qty.matcha, qty.chocolate,
        totalQty, unitPrice, amount, date, cell(d.slot, 20), cell(address, 120), cell(d.note, 500), status]);
      if (!paid) Utilities.sleep(1100); // keeps second-based order IDs unique under the lock
    } finally {
      lock.releaseLock();
    }

    const flavors = Object.keys(PRODUCTS).filter(function (k) { return qty[k]; })
      .map(function (k) { return PRODUCTS[k] + ' ' + qty[k] + ' 顆'; }).join('、');
    const body = [
      '付款：' + status,
      '訂單編號：' + orderId,
      '公司：' + companyName + '（' + companyCode + '）',
      '訂購人：' + name + '　手機：' + phone,
      '部門/分機：' + (str(d.department, 60) || '-') + '　Email：' + (str(d.email, 120) || '-'),
      '',
      '口味：' + flavors,
      '共 ' + totalQty + ' 顆 × NT$' + unitPrice + ' = NT$' + amount,
      '',
      '送達：' + date + ' ' + str(d.slot, 20),
      '地點：' + address,
      '備註：' + (str(d.note, 500) || '-'),
      '',
      '訂單表：' + ss_().getUrl(),
    ].join('\n');
    try {
      MailApp.sendEmail({
        to: Session.getEffectiveUser().getEmail(),
        subject: '【企業訂單】' + status + '｜' + companyName + '｜' + name + '｜' + totalQty + ' 顆｜' + date,
        body: body,
      });
    } catch (mailError) {
      // The row is already saved; reporting failure would make the customer or the Worker send it again.
      console.error('order email failed: ' + orderId + ' ' + mailError);
    }

    return json_({ ok: true, paid: paid, orderId: orderId });
  } catch (err) {
    return json_({ ok: false, error: 'SERVER_ERROR' });
  }
}

function ss_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_() {
  const ss = ss_();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to grant permissions and send a test email. */
function testOrder() {
  const res = doPost({ postData: { contents: JSON.stringify({
    companyCode: 'test', companyName: '測試公司', name: '測試', phone: '0900000000',
    date: '2026-12-01', slot: '10:00–12:00', address: '測試地址', note: '這是測試訂單，可刪除',
    items: [{ id: 'original', quantity: 12 }],
  }) } });
  Logger.log(res.getContent());
}
