import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { campaignTokenDigest } from "../src/security";

const TOKEN = "gongxin-test-access-token-12345678901234567890";

async function seedCampaign(options: { status?: string; deadline?: string | null } = {}) {
  const now = "2026-08-24T00:00:00.000Z";
  const digest = await campaignTokenDigest("gongxin", TOKEN, env.CAMPAIGN_TOKEN_PEPPER);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO campaigns (id, company_name, campaign_name, visibility, status, access_token_digest, order_deadline, delivery_date, delivery_start_time, delivery_end_time, delivery_method, delivery_fee, free_delivery_threshold, note, created_at, updated_at) VALUES (?1, ?2, ?3, 'UNLISTED', ?4, ?5, ?6, NULL, '12:00', '13:00', ?7, 0, 1000, ?8, ?9, ?9)")
      .bind("gongxin", "公信電子", "公信電子員工限定團購", options.status || "ACTIVE", digest, options.deadline ?? null, "公司統一配送／員工現場領取", "商品為冷凍商品，請於指定時間內完成領取。", now),
    env.DB.prepare("INSERT INTO products (id, name, image_url, active, created_at, updated_at) VALUES ('original', '經典原味', '../images/basque-original-cut.png', 1, ?1, ?1), ('matcha', '濃香抹茶', '../images/basque-matcha-cut.png', 1, ?1, ?1), ('chocolate', '醇厚巧克力', '../images/basque-chocolate-cut.png', 1, ?1, ?1)").bind(now),
    env.DB.prepare("INSERT INTO campaign_products (campaign_id, product_id, unit_price, display_order, active) VALUES ('gongxin', 'original', 85, 1, 1), ('gongxin', 'matcha', 85, 2, 1), ('gongxin', 'chocolate', 85, 3, 1)"),
  ]);
}

function campaignRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Campaign ${TOKEN}`);
  return SELF.fetch(`https://groupbuy-api.kennygcake.com${path}`, { ...init, headers });
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM payment_events"),
    env.DB.prepare("DELETE FROM payment_attempts"),
    env.DB.prepare("DELETE FROM order_items"),
    env.DB.prepare("DELETE FROM orders"),
    env.DB.prepare("DELETE FROM campaign_products"),
    env.DB.prepare("DELETE FROM products"),
    env.DB.prepare("DELETE FROM campaigns"),
  ]);
});

describe("campaign API", () => {
  it("returns only campaign catalog and PAID aggregate data", async () => {
    await seedCampaign();
    await env.DB.prepare("INSERT INTO orders (id, campaign_id, company_name_snapshot, customer_name, phone, total_quantity, total_amount, payment_method, payment_status, created_at, updated_at) VALUES ('paid', 'gongxin', '公信電子', 'Private Name', '0911111111', 2, 170, 'LINE_PAY', 'PAID', '2026-08-24', '2026-08-24'), ('pending', 'gongxin', '公信電子', 'Other Name', '0922222222', 10, 850, 'LINE_PAY', 'PENDING', '2026-08-24', '2026-08-24')").run();
    const response = await campaignRequest("/v1/campaigns/gongxin");
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(body.products).toHaveLength(3);
    expect(body.progress).toMatchObject({ paidAmount: 170, paidQuantity: 2, paidOrderCount: 1, remainingAmount: 830, thresholdReached: false });
    expect(JSON.stringify(body)).not.toContain("Private Name");
    expect(JSON.stringify(body)).not.toContain("0911111111");
  });

  it("does not reveal whether a campaign exists when the token is wrong", async () => {
    await seedCampaign();
    const response = await SELF.fetch("https://groupbuy-api.kennygcake.com/v1/campaigns/gongxin", { headers: { Authorization: "Campaign wrong-token-that-is-long-enough-1234567890" } });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "CAMPAIGN_NOT_FOUND" } });
  });
});

describe("pending order API", () => {
  it("recalculates totals from D1 prices and persists PENDING order atomically", async () => {
    await seedCampaign();
    const response = await campaignRequest("/v1/campaigns/gongxin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://kennygcake.com" },
      body: JSON.stringify({ customerName: "測試員工", phone: "0912-345-678", department: "研發", items: [{ productId: "original", quantity: 2 }, { productId: "matcha", quantity: 1 }] }),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://kennygcake.com");
    const body = await response.json() as Record<string, any>;
    expect(body).toMatchObject({ campaignId: "gongxin", paymentStatus: "PENDING", paymentMethod: "LINE_PAY", totalQuantity: 3, totalAmount: 255 });
    const stored = await env.DB.prepare("SELECT payment_status, total_quantity, total_amount FROM orders WHERE id = ?1").bind(body.orderId).first<Record<string, any>>();
    expect(stored).toMatchObject({ payment_status: "PENDING", total_quantity: 3, total_amount: 255 });
    expect((await env.DB.prepare("SELECT * FROM order_items WHERE order_id = ?1 ORDER BY product_id").bind(body.orderId).all()).results).toHaveLength(2);
  });

  it("rejects browser supplied prices", async () => {
    await seedCampaign();
    const response = await campaignRequest("/v1/campaigns/gongxin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: "測試", phone: "0912345678", items: [{ productId: "original", quantity: 1, unitPrice: 1 }] }) });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "CLIENT_PRICE_REJECTED" } });
    expect((await env.DB.prepare("SELECT COUNT(*) count FROM orders").first<{ count: number }>())?.count).toBe(0);
  });

  it("rejects a browser supplied order total", async () => {
    await seedCampaign();
    const response = await campaignRequest("/v1/campaigns/gongxin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: "測試", phone: "0912345678", totalAmount: 1, items: [{ productId: "original", quantity: 1 }] }) });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "CLIENT_PRICE_REJECTED" } });
    expect((await env.DB.prepare("SELECT COUNT(*) count FROM orders").first<{ count: number }>())?.count).toBe(0);
  });

  it("rejects unavailable products without creating a partial order", async () => {
    await seedCampaign();
    const response = await campaignRequest("/v1/campaigns/gongxin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: "測試", phone: "0912345678", items: [{ productId: "missing", quantity: 1 }] }) });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "PRODUCT_UNAVAILABLE" } });
    expect((await env.DB.prepare("SELECT COUNT(*) count FROM orders").first<{ count: number }>())?.count).toBe(0);
  });

  it("rejects new orders after deadline", async () => {
    await seedCampaign({ deadline: "2020-01-01T00:00:00.000Z" });
    const response = await campaignRequest("/v1/campaigns/gongxin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: "測試", phone: "0912345678", items: [{ productId: "original", quantity: 1 }] }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "CAMPAIGN_CLOSED" } });
  });

  it("rejects new orders unless campaign is ACTIVE", async () => {
    await seedCampaign({ status: "DRAFT" });
    const response = await campaignRequest("/v1/campaigns/gongxin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: "測試", phone: "0912345678", items: [{ productId: "original", quantity: 1 }] }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "CAMPAIGN_NOT_ACTIVE" } });
  });
});
