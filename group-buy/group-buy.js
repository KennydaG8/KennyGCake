import { calculateSelection, isOrderingOpen } from "./models.js";
import { createOrder, loadCampaign, requestPayment } from "./api-client.js";

const number = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });
const money = { format: (value) => `NT$${number.format(value)}` };
const dateTime = new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei" });
const dateOnly = new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeZone: "Asia/Taipei" });
const $ = (selector) => document.querySelector(selector);
const quantities = Object.create(null);
let campaign;
let previewMode = false;

function displayDate(value, withTime = false) {
  if (!value) return "待確認";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "待確認" : (withTime ? dateTime : dateOnly).format(date);
}

function showError(code) {
  const copy = {
    MISSING_CAMPAIGN: ["缺少活動資訊", "請重新掃描試吃桌上的 QR Code。"],
    INVALID_ACCESS: ["活動連結無效", "此為企業限定活動，請使用試吃現場提供的完整 QR Code。"],
    CAMPAIGN_NOT_FOUND: ["找不到這次活動", "請向現場工作人員確認 QR Code 是否正確。"],
    CAMPAIGN_LOAD_FAILED: ["暫時無法載入活動", "請確認網路後再試一次。"],
  }[code] || ["暫時無法開啟頁面", "請稍後再試一次。"];
  $("#loading-state").hidden = true;
  $("#campaign-content").hidden = true;
  $("#error-title").textContent = copy[0];
  $("#error-message").textContent = copy[1];
  $("#error-state").hidden = false;
}

function renderMeta() {
  const times = campaign.deliveryStartTime && campaign.deliveryEndTime ? `${campaign.deliveryStartTime}～${campaign.deliveryEndTime}` : "待確認";
  const rows = [
    ["結單時間", displayDate(campaign.orderDeadline, true)],
    ["統一交貨日期", displayDate(campaign.deliveryDate)],
    ["交貨時間", times],
    ["領取方式", campaign.deliveryMethod],
  ];
  $("#campaign-meta").replaceChildren(...rows.map(([label, value]) => {
    const div = document.createElement("div");
    div.className = "meta-item";
    const small = document.createElement("small"); small.textContent = label;
    const strong = document.createElement("strong"); strong.textContent = value;
    div.append(small, strong);
    return div;
  }));
}

function renderProgress() {
  const threshold = campaign.freeDeliveryThreshold;
  const amount = campaign.paidAmount;
  const percent = threshold ? Math.min(100, Math.round(amount / threshold * 100)) : 100;
  $("#progress-percent").textContent = `${percent}%`;
  $("#progress-amount").textContent = threshold ? `${money.format(amount)} / ${money.format(threshold)}` : `${money.format(amount)} 已付款`;
  $("#progress-bar").style.width = `${percent}%`;
  const track = $(".progress-track"); track.setAttribute("aria-valuenow", String(percent));
  $("#progress-copy").textContent = percent >= 100 ? "已成團！本次公司統一配送免運。" : `還差 ${money.format(threshold - amount)} 即成團免運。`;
}

function updateTotals() {
  const summary = calculateSelection(campaign, quantities);
  $("#total-quantity").textContent = String(summary.totalQuantity);
  $("#total-amount").textContent = money.format(summary.totalAmount);
  const button = $("#checkout-button");
  button.disabled = summary.totalQuantity === 0 || !isOrderingOpen(campaign);
  button.textContent = summary.totalQuantity === 0 ? "請先選擇商品" : previewMode ? "Phase 1 預覽：尚未啟用付款" : "前往 LINE Pay";
  button.dataset.summary = JSON.stringify(summary);
}

function renderProducts() {
  const cards = campaign.products.map((product) => {
    quantities[product.id] = 0;
    const article = document.createElement("article"); article.className = "product-card";
    const img = document.createElement("img"); img.src = product.imageUrl; img.alt = `${product.name}巴斯克乳酪蛋糕`; img.loading = "lazy";
    const body = document.createElement("div"); body.className = "product-body";
    const info = document.createElement("div");
    const title = document.createElement("h3"); title.textContent = product.name;
    const price = document.createElement("p"); price.className = "price"; price.textContent = `${money.format(product.unitPrice)}／顆`;
    info.append(title, price);
    const control = document.createElement("div"); control.className = "quantity-control";
    const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−"; minus.disabled = true; minus.setAttribute("aria-label", `減少${product.name}數量`);
    const output = document.createElement("output"); output.textContent = "0"; output.setAttribute("aria-label", `${product.name}數量`);
    const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.setAttribute("aria-label", `增加${product.name}數量`);
    const setQuantity = (next) => { quantities[product.id] = Math.max(0, Math.min(99, next)); output.textContent = String(quantities[product.id]); minus.disabled = quantities[product.id] === 0; plus.disabled = quantities[product.id] === 99; updateTotals(); };
    minus.addEventListener("click", () => setQuantity(quantities[product.id] - 1));
    plus.addEventListener("click", () => setQuantity(quantities[product.id] + 1));
    control.append(minus, output, plus); body.append(info, control); article.append(img, body);
    return article;
  });
  $("#product-list").replaceChildren(...cards);
  updateTotals();
}

function renderCampaign() {
  document.title = `${campaign.campaignName}｜KennyG Cake`;
  $("#company-name").textContent = campaign.companyName;
  $("#campaign-name").textContent = campaign.campaignName;
  $("#campaign-note").textContent = campaign.note || "商品為冷凍商品，請於指定時間內完成領取。";
  if (campaign.bundlePricing) $("#pricing-copy").textContent = `三種口味任選 ${campaign.bundlePricing.quantity} 顆 ${money.format(campaign.bundlePricing.price)}，可自由混搭。`;
  renderMeta(); renderProgress(); renderProducts();
  if (!isOrderingOpen(campaign)) {
    $("#checkout-button").disabled = true;
    $("#checkout-button").textContent = campaign.status === "DELIVERED" ? "本次企業團購活動已結束" : "本次企業團購已結單";
  }
  $("#loading-state").hidden = true;
  $("#campaign-content").hidden = false;
}

$("#order-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const summary = JSON.parse($("#checkout-button").dataset.summary || "{}");
  if (!summary.totalQuantity) return;
  if (!event.currentTarget.reportValidity()) return;
  if (previewMode) {
    $("#form-message").textContent = "Phase 1 僅驗證介面與資料模型，不會建立訂單或連接 LINE Pay。";
    return;
  }
  const button=$("#checkout-button"), form=new FormData(event.currentTarget); button.disabled=true; button.textContent="建立測試訂單中…";
  try {
    const params=new URLSearchParams(window.location.hash.slice(1) || window.location.search), access=params.get("access");
    const order=await createOrder(campaign.id,access,{customerName:form.get("customerName"),phone:form.get("phone"),department:form.get("department"),lineName:form.get("lineName"),note:form.get("note"),items:summary.items});
    button.textContent="前往 LINE Pay…"; const payment=await requestPayment(campaign.id,access,order.orderId); window.location.assign(payment.paymentUrl);
  } catch (error) { $("#form-message").textContent=`無法建立付款：${error instanceof Error ? error.message : "UNKNOWN"}`; button.disabled=false; button.textContent="前往 LINE Pay"; }
});

try {
  const result = await loadCampaign();
  campaign = result.campaign;
  previewMode = result.preview;
  renderCampaign();
} catch (error) {
  showError(error instanceof Error ? error.message : "CAMPAIGN_LOAD_FAILED");
}
