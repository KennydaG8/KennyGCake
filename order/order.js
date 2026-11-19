// Shared employee order page: https://kennygcake.com/order/?c=<company code>
// Add a company by adding an entry to COMPANIES. The link is not on the homepage.

// Google Apps Script web app URL (see order/apps-script/README.md).
const ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfycbw2Kiu6Bp3odWZkNVEFexEdSh0pynd1fj5pU29W7okjvJJH-6Zi3Uua1Fxkfl-1mJky/exec";

const BASE_PRICE = 85;
const DEFAULT_UNIT_PRICE = 76; // 9 折，85 × 0.9 取整數
const MIN_QTY = 12;
const LEAD_WORKDAYS = 3;
const DEFAULT_SLOTS = ["10:00–12:00", "12:00–14:00", "14:00–17:00"];

const COMPANIES = {
  bigdata: {
    name: "大數據股份有限公司",
    address: "台北市民生東路二段145號5樓",
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

function renderProducts() {
  const cards = PRODUCTS.map((p) => {
    const el = document.createElement("article");
    el.className = "product";
    el.innerHTML = `
      <img alt="" loading="lazy">
      <div><h3></h3><p></p></div>
      <div class="qty">
        <button type="button" data-step="-1" aria-label="減少">−</button>
        <input type="number" inputmode="numeric" min="0" max="200" value="0">
        <button type="button" data-step="1" aria-label="增加">+</button>
      </div>`;
    el.querySelector("img").src = p.image;
    el.querySelector("h3").textContent = `${p.name}巴斯克`;
    el.querySelector("p").textContent = `${p.desc} · ${money(unitPrice)}`;
    const input = el.querySelector("input");
    input.setAttribute("aria-label", `${p.name}數量`);
    const minus = el.querySelector('[data-step="-1"]');
    const set = (n) => {
      quantities[p.id] = Math.max(0, Math.min(200, Number.isFinite(n) ? Math.trunc(n) : 0));
      input.value = quantities[p.id];
      minus.disabled = quantities[p.id] === 0;
      refresh();
    };
    el.querySelectorAll("button").forEach((b) => (b.onclick = () => set(quantities[p.id] + Number(b.dataset.step))));
    input.addEventListener("input", () => set(Number(input.value)));
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
  if (!/^[0-9+\-\s()]{8,20}$/.test(data.phone)) return "請填寫正確的手機號碼。";
  if (!data.date) return "請選擇送達日期。";
  const [y, m, d] = data.date.split("-").map(Number);
  const picked = new Date(y, m - 1, d);
  if (isWeekend(picked)) return "送達日期請選平日（週一到週五）。";
  if (picked < earliestDelivery()) return `最快可送達日期是 ${form.elements.date.min}。`;
  if (!data.address) return "請填寫送達地點。";
  return "";
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
    $("#done-summary").textContent = `訂單編號 ${body.orderId}｜${lines}，共 ${payload.totalQuantity} 顆 ${money(payload.totalAmount)}｜${data.date} ${data.slot}`;
    $("#order-view").hidden = true;
    $("#done-state").hidden = false;
    scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    msg.textContent = `送出失敗，請稍後再試或直接聯絡 Kenny。（${err instanceof Error ? err.message : "UNKNOWN"}）`;
    button.disabled = false;
    button.textContent = "送出訂單";
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
  $("#order-view").hidden = false;
}
