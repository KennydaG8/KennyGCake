import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Entry } from "@napi-rs/keyring";

const origin = "https://kennygcake.com";
const baseUrl = "https://kennygcake-group-buy-api-staging.kennygcake-group-buy-backend.workers.dev";
const token = new Entry("kennygcake-group-buy-staging", "gongxin-access-token").getPassword();
if (!token) throw new Error("Staging campaign token is missing from Windows Credential Manager");
const wranglerCli = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

const results = [];
const record = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
};
const request = async (path, init = {}, useToken = true) => {
  const headers = new Headers(init.headers);
  if (useToken) headers.set("Authorization", `Campaign ${token}`);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
};
const postOrder = (body, extra = {}) => request("/v1/campaigns/gongxin/orders", { method: "POST", headers: { "Content-Type": "application/json", ...extra }, body: JSON.stringify(body) });
const d1 = (sql) => {
  const run = spawnSync(process.execPath, [wranglerCli, "d1", "execute", "kennygcake-group-buy-staging", "--remote", "--config", "wrangler.staging.toml", "--command", sql, "--json"], { encoding: "utf8", shell: false });
  if (run.error || run.status !== 0) {
    throw new Error(`Remote D1 test setup failed (${run.error?.code ?? `exit ${run.status}`})`);
  }
  return JSON.parse(run.stdout);
};
const fakeOrder = { customerName: "測試員工A", phone: "0912345678", department: "測試部門", lineName: "測試LINE", note: "STAGING TEST DATA", items: [{ productId: "original", quantity: 2 }, { productId: "matcha", quantity: 1 }] };

try {
  let response = await request("/health", {}, false);
  record("Health", response.status === 200 && (await response.json()).status === "ok", `HTTP ${response.status}`);

  response = await request("/v1/campaigns/gongxin");
  const campaign = await response.json();
  record("Campaign Token", response.status === 200 && campaign.id === "gongxin" && campaign.products?.length === 3, `HTTP ${response.status}`);
  record("PII", !/測試員工|0912345678|測試部門|測試LINE/.test(JSON.stringify(campaign)), "campaign response contains no employee data");

  response = await fetch(`${baseUrl}/v1/campaigns/gongxin`, { headers: { Authorization: "Campaign invalid-token-value-that-is-at-least-thirty-two" } });
  record("Invalid Token", response.status === 404 && (await response.json()).error?.code === "CAMPAIGN_NOT_FOUND", `HTTP ${response.status}`);

  d1("UPDATE campaigns SET status = 'DRAFT' WHERE id = 'gongxin'");
  response = await postOrder(fakeOrder);
  record("Campaign Status", response.status === 409 && (await response.json()).error?.code === "CAMPAIGN_NOT_ACTIVE", `HTTP ${response.status}`);
  d1("UPDATE campaigns SET status = 'ACTIVE', order_deadline = '2020-01-01T00:00:00.000Z' WHERE id = 'gongxin'");
  response = await postOrder(fakeOrder);
  record("Deadline", response.status === 409 && (await response.json()).error?.code === "CAMPAIGN_CLOSED", `HTTP ${response.status}`);
  d1("UPDATE campaigns SET order_deadline = '2026-12-31T15:59:59.000Z' WHERE id = 'gongxin'");

  response = await postOrder({ ...fakeOrder, totalAmount: 1 });
  const topPriceRejected = response.status === 422 && (await response.json()).error?.code === "CLIENT_PRICE_REJECTED";
  response = await postOrder({ ...fakeOrder, items: [{ productId: "original", quantity: 1, unitPrice: 1 }] });
  record("Server-side Price", topPriceRejected && response.status === 422 && (await response.json()).error?.code === "CLIENT_PRICE_REJECTED");

  response = await postOrder({ ...fakeOrder, items: [{ productId: "missing", quantity: 1 }] });
  const missingRejected = response.status === 422;
  d1("UPDATE campaign_products SET active = 0 WHERE campaign_id = 'gongxin' AND product_id = 'chocolate'");
  response = await postOrder({ ...fakeOrder, items: [{ productId: "chocolate", quantity: 1 }] });
  const inactiveRejected = response.status === 422;
  d1("UPDATE campaign_products SET active = 1 WHERE campaign_id = 'gongxin' AND product_id = 'chocolate'; INSERT INTO products (id, name, image_url, active, created_at, updated_at) VALUES ('other-only', 'Other Test', '/none', 1, datetime('now'), datetime('now'))");
  response = await postOrder({ ...fakeOrder, items: [{ productId: "other-only", quantity: 1 }] });
  record("Product Validation", missingRejected && inactiveRejected && response.status === 422);

  response = await postOrder(fakeOrder, { Origin: origin });
  const pending = await response.json();
  record("Pending Order", response.status === 201 && pending.paymentStatus === "PENDING" && pending.totalQuantity === 3 && pending.totalAmount === 255, `HTTP ${response.status}`);
  record("CORS allowed", response.headers.get("Access-Control-Allow-Origin") === origin);
  response = await fetch(`${baseUrl}/v1/campaigns/gongxin`, { method: "OPTIONS", headers: { Origin: "https://example.invalid", "Access-Control-Request-Method": "GET" } });
  record("CORS denied", response.status === 403 && !response.headers.has("Access-Control-Allow-Origin"), `HTTP ${response.status}`);

  d1(`UPDATE orders SET payment_status = 'PAID', paid_at = datetime('now') WHERE id = '${String(pending.orderId).replaceAll("'", "''")}'; INSERT INTO orders (id, campaign_id, company_name_snapshot, customer_name, phone, total_quantity, total_amount, payment_method, payment_status, created_at, updated_at) VALUES ('SMOKE-FAILED', 'gongxin', 'STAGING', 'Fake Failed', '0900000000', 10, 850, 'LINE_PAY', 'FAILED', datetime('now'), datetime('now')), ('SMOKE-CANCELLED', 'gongxin', 'STAGING', 'Fake Cancelled', '0900000000', 10, 850, 'LINE_PAY', 'CANCELLED', datetime('now'), datetime('now'))`);
  response = await request("/v1/campaigns/gongxin/progress");
  const progress = await response.json();
  record("Aggregate Progress", response.status === 200 && progress.paidOrderCount === 1 && progress.paidQuantity === 3 && progress.paidAmount === 255 && progress.remainingAmount === 745);
  record("Progress PII", !/Fake|0900000000|測試員工/.test(JSON.stringify(progress)));
} finally {
  d1("DELETE FROM order_items; DELETE FROM payment_events; DELETE FROM payment_attempts; DELETE FROM orders; DELETE FROM products WHERE id = 'other-only'; UPDATE campaigns SET status = 'ACTIVE', order_deadline = '2026-12-31T15:59:59.000Z' WHERE id = 'gongxin'; UPDATE campaign_products SET active = 1 WHERE campaign_id = 'gongxin'");
}

if (results.some((result) => !result.passed)) process.exitCode = 1;
console.log(`Remote staging smoke tests: ${results.filter((result) => result.passed).length}/${results.length} passed.`);
