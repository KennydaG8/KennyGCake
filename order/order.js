// Shared employee order page: https://kennygcake.com/order/?c=<company code>
// Add a company by adding an entry to COMPANIES. The link is not on the homepage.

// Google Apps Script web app URL (see order/apps-script/README.md).
const ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfycbw2Kiu6Bp3odWZkNVEFexEdSh0pynd1fj5pU29W7okjvJJH-6Zi3Uua1Fxkfl-1mJky/exec";

// LINE Pay orders go to the group-buy Worker (group-buy-backend/). The campaign ID is the company code.
const PAY_API = "https://kennygcake-group-buy-api-production.kennygcake-group-buy-backend.workers.dev/v1/campaigns";

const BASE_PRICE = 85;
const DEFAULT_UNIT_PRICE = 76; // 9 折，85 × 0.9 取整數
const MIN_QTY = 12;
const LEAD_WORKDAYS = 3;
const DEFAULT_SLOTS = ["10:00–12:00", "12:00–14:00", "14:00–17:00"];

const COMPANIES = {
  bigdata: {
    name: "大數據股份有限公司",
    address: "台北市民生東路二段145號5樓",
    linePay: true, // needs a campaign with the same code and price in the Worker
  },
};

const PRODUCTS = [
  { id: "original", name: "原味", desc: "經典焦香流心", image: "../images/basque-original-cut.png" },
  { id: "matcha", name: "抹茶", desc: "濃郁抹茶乳酪", image: "../images/basque-matcha-cut.png" },
  { id: "chocolate", name: "巧克力", desc: "醇厚可可微苦甜", image: "../images/basque-chocolate-cut.png" },
];

const $ = (s) => document.querySelector(s);
const money = (n) => `NT$${new Intl.NumberFormat("zh-TW").format(n)}`;
const code = (new URLSearchParams(location.search).get("c") || "").trim().toLowerCase();
const company = Object.hasOwn(COMPANIES, code) ? COMPANIES[code] : null;
const unitPrice = company?.unitPrice ?? DEFAULT_UNIT_PRICE;
const quantities = Object.fromEntries(PRODUCTS.map((p) => [p.id, 0]));
const form = $("#order-form");
const MAX_PER_FLAVOR = 99;
const DRAFT_KEY = `kennyg-order-${code}`;
const payMethod = () => (company?.linePay ? form.elements.payment.value : "ON_DELIVERY");
const submitLabel = () => (payMethod() === "LINE_PAY" ? "前往 LINE Pay 付款" : "送出訂單");

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

export function earliestDelivery(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let added = 0;
  while (added < LEAD_WORKDAYS) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) added++;
  }
  return d;
}

function totalQty() {
  return Object.values(quantities).reduce((a, b) => a + b, 0);
}

function refresh() {
  const qty = totalQty();
  $("#total-qty").textContent = qty;
  $("#total-amount").textContent = money(qty * unitPrice);
  const note = $("#qty-note");
  if (qty === 0) {
    note.textContent = `最少 ${MIN_QTY} 顆，三種口味可以混搭。`;
    note.className = "qty-note";
  } else if (qty < MIN_QTY) {
    note.textContent = `還差 ${MIN_QTY - qty} 顆就能送出（最少 ${MIN_QTY} 顆）。`;
    note.className = "qty-note warn";
  } else {
    note.textContent = "數量 OK，親自冷藏送到公司，不另收運費。";
    note.className = "qty-note ok";
  }
  $("#submit-button").disabled = qty < MIN_QTY;
}

const setters = {};

function renderProducts() {
  const cards = PRODUCTS.map((p) => {
    const el = document.createElement("article");
    el.className = "product";
    el.innerHTML = `
      <img alt="" loading="lazy">
      <div><h3></h3><p></p></div>
      <div class="qty">
        <button type="button" data-step="-1" aria-label="減少">−</button>
        <input type="number" inputmode="numeric" min="0" max="${MAX_PER_FLAVOR}" value="0">
        <button type="button" data-step="1" aria-label="增加">+</button>
      </div>`;
    el.querySelector("img").src = p.image;
    el.querySelector("h3").textContent = `${p.name}巴斯克`;
    el.querySelector("p").textContent = `${p.desc} · ${money(unitPrice)}`;
    const input = el.querySelector("input");
    input.setAttribute("aria-label", `${p.name}數量`);
    const minus = el.querySelector('[data-step="-1"]');
    const set = (n) => {
      quantities[p.id] = Math.max(0, Math.min(MAX_PER_FLAVOR, Number.isFinite(n) ? Math.trunc(n) : 0));
      input.value = quantities[p.id];
      minus.disabled = quantities[p.id] === 0;
      refresh();
    };
    el.querySelectorAll("button").forEach((b) => (b.onclick = () => set(quantities[p.id] + Number(b.dataset.step))));
    input.addEventListener("input", () => set(Number(input.value)));
    setters[p.id] = set;
    set(0);
    return el;
  });
  $("#product-list").replaceChildren(...cards);
}

function setupFields() {
  const min = earliestDelivery();
  const dateInput = form.elements.date;
  dateInput.min = isoDate(min);
  dateInput.value = isoDate(min);
  const slots = company.slots || DEFAULT_SLOTS;
  $("#slot-select").replaceChildren(...slots.map((s) => new Option(s, s)));
  form.elements.address.value = company.address || "";
}

function validate(data) {
  if (totalQty() < MIN_QTY) return `最少 ${MIN_QTY} 顆。`;
  if (!data.name) return "請填寫姓名。";
  if (!/^(09|\+8869)\d{8}$/.test(data.phone.replace(/[\s-]/g, ""))) return "請填寫正確的手機號碼。";
  if (!data.date) return "請選擇送達日期。";
  const [y, m, d] = data.date.split("-").map(Number);
  const picked = new Date(y, m - 1, d);
  if (isWeekend(picked)) return "送達日期請選平日（週一到週五）。";
  if (picked < earliestDelivery()) return `最快可送達日期是 ${form.elements.date.min}。`;
  if (!data.address) return "請填寫送達地點。";
  return "";
}

const PAY_NOTES = {
  LINE_PAY: "付款完成後訂單才成立，Kenny 收到款項後會安排送達。",
  CASH: "蛋糕送達時以現金付款，請自備零錢。收到訂單後，Kenny 會以電話或簡訊和您確認。",
};

function refreshPayment() {
  if (!company.linePay) return;
  $("#pay-note").textContent = PAY_NOTES[payMethod()];
  $("#submit-button").textContent = submitLabel();
}

// The draft only lives in this tab, so the form can be refilled when someone cancels at LINE Pay.
function saveDraft(data, orderId, summary) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ data, quantities, orderId, summary })); } catch { /* private mode */ }
}
function readDraft() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)); } catch { return null; }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
}
function restoreDraft() {
  const draft = readDraft();
  if (!draft) return;
  for (const [id, n] of Object.entries(draft.quantities || {})) setters[id]?.(Number(n));
  for (const [k, v] of Object.entries(draft.data || {})) {
    const field = form.elements[k];
    if (field && k !== "website" && !(k === "date" && v < field.min)) field.value = v;
  }
}

function showDone({ title, summary, next }) {
  $("#done-title").textContent = title;
  $("#done-summary").textContent = summary;
  $("#done-next").textContent = next;
  $("#order-view").hidden = true;
  $("#checking-state").hidden = true;
  $("#done-state").hidden = false;
  scrollTo({ top: 0, behavior: "smooth" });
}

async function payApi(path, init) {
  const res = await fetch(`${PAY_API}/${code}${path}`, { cache: "no-store", ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.code || `HTTP_${res.status}`);
  return body;
}

async function payWithLine(data, items) {
  const order = await payApi("/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: data.name,
      phone: data.phone,
      department: data.department,
      email: data.email,
      note: data.note,
      deliveryDate: data.date,
      deliverySlot: data.slot,
      deliveryAddress: data.address,
      items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
    }),
  });
  // The server sets the price. Stop if this page shows something else.
  if (order.totalAmount !== totalQty() * unitPrice) throw new Error("PRICE_MISMATCH");
  const payment = await payApi(`/orders/${encodeURIComponent(order.orderId)}/payments`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID().replaceAll("-", "") },
  });
  const url = new URL(payment.paymentUrl);
  if (url.protocol !== "https:" || !/(^|\.)line\.me$/.test(url.hostname)) throw new Error("INVALID_PAYMENT_URL");
  const lines = items.map((i) => `${i.name} ${i.quantity}`).join("、");
  saveDraft(data, order.orderId, `訂單編號 ${order.orderId}｜${lines}，共 ${order.totalQuantity} 顆 ${money(order.totalAmount)}｜${data.date} ${data.slot}`);
  location.assign(url);
}

// Back from LINE Pay: #pay=done|cancelled|failed&id=PAY-…  The server's status decides, not the link.
async function handleReturn() {
  const params = new URLSearchParams(location.hash.slice(1));
  const result = params.get("pay");
  const id = params.get("id") || "";
  if (!company.linePay || !["done", "cancelled", "failed"].includes(result) || !/^PAY-[A-Za-z0-9]{8,40}$/.test(id)) return;
  history.replaceState(null, "", location.pathname + location.search);
  $("#order-view").hidden = true;
  $("#checking-state").hidden = false;
  let payment = null;
  for (let i = 0; i < (result === "cancelled" ? 1 : 4); i++) {
    if (i) await new Promise((r) => setTimeout(r, 2000));
    payment = await payApi(`/payments/${id}`).catch(() => null);
    if (payment?.status === "CONFIRMED") break;
  }
  if (payment?.status === "CONFIRMED") {
    // The draft may belong to a later order opened in this tab; only use it for the order that was paid.
    const draft = readDraft();
    const mine = draft?.orderId === payment.orderId;
    const summary = mine ? draft.summary : `訂單編號 ${payment.orderId}`;
    if (mine) clearDraft();
    showDone({ title: "付款完成，訂單已成立", summary, next: "Kenny 會以電話或簡訊和您確認送達時間。" });
    return;
  }
  $("#checking-state").hidden = true;
  $("#order-view").hidden = false;
  restoreDraft();
  refreshPayment();
  $("#form-message").textContent = result === "cancelled"
    ? "已取消付款，訂單還沒成立。確認內容後可以重新付款。"
    : "還沒確認到付款，訂單可能沒有成立。如果 LINE Pay 顯示已付款，請不要重複付款，直接聯絡 Kenny。";
  $("#submit-button").scrollIntoView({ block: "center" });
}

async function submit(e) {
  e.preventDefault();
  const fd = new FormData(form);
  const data = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).trim()]));
  const error = validate(data);
  const msg = $("#form-message");
  msg.textContent = error;
  if (error) return;

  const items = PRODUCTS.filter((p) => quantities[p.id] > 0).map((p) => ({ id: p.id, name: p.name, quantity: quantities[p.id] }));
  if (payMethod() === "LINE_PAY") {
    if (data.website) return; // honeypot filled = bot
    const button = $("#submit-button");
    button.disabled = true;
    button.textContent = "前往 LINE Pay…";
    try {
      await payWithLine(data, items);
    } catch (err) {
      msg.textContent = `無法開啟 LINE Pay，還沒有扣款。請稍後再試，或改選現場現金付款。（${err instanceof Error ? err.message : "UNKNOWN"}）`;
      button.disabled = false;
      button.textContent = submitLabel();
    }
    return;
  }

  const payload = {
    companyCode: code,
    companyName: company.name,
    unitPrice,
    items,
    totalQuantity: totalQty(),
    totalAmount: totalQty() * unitPrice,
    ...data,
  };

  const button = $("#submit-button");
  button.disabled = true;
  button.textContent = "送出中…";
  try {
    // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
    const res = await fetch(ORDER_ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP_${res.status}`);
    const lines = items.map((i) => `${i.name} ${i.quantity}`).join("、");
    clearDraft();
    showDone({
      title: "訂單已送出",
      summary: `訂單編號 ${body.orderId}｜${lines}，共 ${payload.totalQuantity} 顆 ${money(payload.totalAmount)}｜${data.date} ${data.slot}`,
      next: company.linePay ? "Kenny 會以電話或簡訊和您確認。送達時請以現金付款，並自備零錢。" : "Kenny 會盡快以電話或簡訊和您確認。",
    });
  } catch (err) {
    msg.textContent = `送出失敗，請稍後再試或直接聯絡 Kenny。（${err instanceof Error ? err.message : "UNKNOWN"}）`;
    button.disabled = false;
    button.textContent = submitLabel();
  }
}

if (!company) {
  $("#invalid-state").hidden = false;
} else {
  document.title = `${company.name} 同仁專屬訂購｜KennyG Cake`;
  $("#company-name").textContent = company.name;
  $("#unit-price").textContent = money(unitPrice);
  $("#base-price").textContent = money(BASE_PRICE);
  document.querySelectorAll(".min-qty").forEach((el) => (el.textContent = MIN_QTY));
  renderProducts();
  setupFields();
  form.addEventListener("submit", submit);
  $("#pay-methods").hidden = !company.linePay;
  form.querySelectorAll('[name="payment"]').forEach((el) => el.addEventListener("change", refreshPayment));
  refreshPayment();
  // Coming back with the browser's back button can leave the button stuck on "前往 LINE Pay…".
  addEventListener("pageshow", (e) => { if (e.persisted) { refresh(); refreshPayment(); } });
  $("#order-view").hidden = false;
  handleReturn();
}
