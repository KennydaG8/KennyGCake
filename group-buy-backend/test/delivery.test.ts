import { applyD1Migrations, createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import { earliestDelivery, validateDelivery } from "../src/delivery";
import { sweep } from "../src/notify";
import { requestPayment } from "../src/payment";

const TX = "2026112512345678901";
const NOTIFY_HOST = "script.google.com";
const originalFetch = globalThis.fetch;
const notifyCalls: any[] = [];
let notifyReply: unknown;
let confirmReply: () => Response;
let checkCode: string;

const ok = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
const futureDate = () => new Date(earliestDelivery(new Date())).toISOString().slice(0, 10);

async function call(path: string, init: RequestInit = {}) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(`https://api.test${path}`, init), env as any, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}
function order(overrides: Record<string, unknown> = {}) {
  return call("/v1/campaigns/bigdata/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerName: "測試", phone: "0912345678", email: "a@b.test", note: "冷凍", deliveryDate: futureDate(), deliverySlot: "10:00–12:00", deliveryAddress: "測試路 1 號", items: [{ productId: "original", quantity: 7 }, { productId: "matcha", quantity: 5 }], ...overrides }),
  });
}
async function requested() {
  const created = await (await order()).json() as any;
  const payment = await (await call(`/v1/campaigns/bigdata/orders/${created.orderId}/payments`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID().replaceAll("-", "") } })).json() as any;
  return { created, payment };
}
const row = (id: string) => env.DB.prepare("SELECT * FROM orders WHERE id=?1").bind(id).first<any>();

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["payment_events", "payment_attempts", "order_items", "orders", "campaign_products", "products", "campaigns"]) await env.DB.prepare(`DELETE FROM ${t}`).run();
  const t = "2026-11-25T00:00:00.000Z";
  await env.DB.batch([
    env.DB.prepare("INSERT INTO campaigns (id, company_name, campaign_name, status, access_token_digest, delivery_method, created_at, updated_at, public_access, requires_delivery, min_quantity) VALUES ('bigdata','大數據','同仁專屬訂購','ACTIVE',?2,'KennyG 親自配送',?1,?1,1,1,12)").bind(t, "0".repeat(64)),
    env.DB.prepare("INSERT INTO products (id, name, image_url, active, created_at, updated_at) VALUES ('original','原味','x',1,?1,?1),('matcha','抹茶','x',1,?1,?1)").bind(t),
    env.DB.prepare("INSERT INTO campaign_products (campaign_id, product_id, unit_price, display_order, active) VALUES ('bigdata','original',76,1,1),('bigdata','matcha',76,2,1)"),
  ]);
  notifyCalls.length = 0;
  notifyReply = { ok: true, paid: true };
  confirmReply = () => ok({ returnCode: "0000", returnMessage: "OK" });
  checkCode = "0000";
  globalThis.fetch = async (input: any, init?: any) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.hostname === NOTIFY_HOST) { notifyCalls.push(JSON.parse(init.body)); return ok(notifyReply); }
    if (url.pathname.endsWith("/request")) return ok({ returnCode: "0000", returnMessage: "OK", info: { transactionId: TX, paymentUrl: { web: "https://sandbox-web-pay.line.me/x" } } });
    if (url.pathname.endsWith("/confirm")) return confirmReply();
    if (url.pathname.endsWith("/check")) return ok({ returnCode: checkCode, returnMessage: "" });
    throw new Error(`unexpected fetch ${url}`);
  };
});
afterEach(() => { globalThis.fetch = originalFetch; });

describe("delivery dates", () => {
  it("counts three workdays in Taipei time and skips weekends", () => {
    const day = (iso: string) => new Date(earliestDelivery(new Date(iso))).toISOString().slice(0, 10);
    expect(day("2026-11-25T04:00:00Z")).toBe("2026-11-30"); // Wed -> Thu, Fri, Mon
    expect(day("2026-11-25T17:00:00Z")).toBe("2026-12-01"); // already Thursday in Taipei
  });
  it("rejects bad dates and slots", () => {
    const now = new Date("2026-11-25T04:00:00Z");
    const body = { deliveryDate: "2026-11-30", deliverySlot: "10:00–12:00", deliveryAddress: "x" };
    expect(validateDelivery(body, now).date).toBe("2026-11-30");
    for (const deliveryDate of ["2026-11-27", "2026-12-05", "2026-02-30", "2030-01-01", "nope", ""]) expect(() => validateDelivery({ ...body, deliveryDate }, now)).toThrow();
    expect(() => validateDelivery({ ...body, deliverySlot: "03:00" }, now)).toThrow();
    expect(() => validateDelivery({ ...body, deliveryAddress: " " }, now)).toThrow();
  });
});

describe("company order page payments", () => {
  it("prices on the server, stores delivery details, and enforces the minimum", async () => {
    const created = await (await order()).json() as any;
    expect(created.totalAmount).toBe(912);
    expect(await row(created.orderId)).toMatchObject({ email: "a@b.test", delivery_slot: "10:00–12:00", delivery_address: "測試路 1 號", note: "冷凍", payment_status: "PENDING" });
    expect((await order({ items: [{ productId: "original", quantity: 11 }] })).status).toBe(422);
    expect((await order({ deliveryDate: undefined })).status).toBe(422);
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM orders").first<any>()).n).toBe(1);
  });

  it("confirms, notifies Kenny once, and returns to the order page", async () => {
    const { created, payment } = await requested();
    const back = await call(`/v1/payments/${payment.id}/confirm?transactionId=${TX}`);
    expect(back.status).toBe(303);
    expect(back.headers.get("Location")).toBe(`https://kennygcake.com/order/?c=bigdata#pay=done&id=${payment.id}`);
    await call(`/v1/payments/${payment.id}/confirm?transactionId=${TX}`);
    await sweep(env as any);
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0]).toMatchObject({ paidSecret: env.ORDER_NOTIFY_SECRET, orderId: created.orderId, totalAmount: 912, companyCode: "bigdata", address: "測試路 1 號" });
    expect((await row(created.orderId)).notified_at).toBeTruthy();
    const status = await (await call(`/v1/campaigns/bigdata/payments/${payment.id}`)).json() as any;
    expect(status).toMatchObject({ status: "CONFIRMED", orderId: created.orderId });
    expect(JSON.stringify(status)).not.toContain("0912345678");
  });

  it("does not notify or mark paid when the transaction does not match or LINE Pay refuses", async () => {
    const { created, payment } = await requested();
    expect((await call(`/v1/payments/${payment.id}/confirm?transactionId=999`)).headers.get("Location")).toContain("pay=failed");
    confirmReply = () => ok({ returnCode: "1172", returnMessage: "no" });
    expect((await call(`/v1/payments/${payment.id}/confirm?transactionId=${TX}`)).headers.get("Location")).toContain("pay=failed");
    expect((await row(created.orderId)).payment_status).toBe("PENDING");
    expect(notifyCalls).toHaveLength(0);
  });

  it("returns cancelled payments to the page without notifying", async () => {
    const { created, payment } = await requested();
    expect((await call(`/v1/payments/${payment.id}/cancel`)).headers.get("Location")).toContain("pay=cancelled");
    expect((await row(created.orderId)).payment_status).toBe("CANCELLED");
    expect(notifyCalls).toHaveLength(0);
  });

  it("recovers a payment whose confirm reply was lost", async () => {
    const { created, payment } = await requested();
    confirmReply = () => { throw new Error("network"); };
    expect((await call(`/v1/payments/${payment.id}/confirm?transactionId=${TX}`)).headers.get("Location")).toContain("pay=failed");
    checkCode = "0123";
    await sweep(env as any);
    expect((await row(created.orderId)).payment_status).toBe("PAID");
    expect(notifyCalls).toHaveLength(1);
  });

  it("retries until a receiver that understands payments accepts", async () => {
    const { created, payment } = await requested();
    notifyReply = { ok: true }; // the old Apps Script
    await call(`/v1/payments/${payment.id}/confirm?transactionId=${TX}`);
    expect((await row(created.orderId)).notified_at).toBeNull();
    notifyReply = { ok: true, paid: true };
    await sweep(env as any);
    expect((await row(created.orderId)).notified_at).toBeTruthy();
  });

  it("refuses to take money when Kenny could not be told", async () => {
    const created = await (await order()).json() as any;
    const request = new Request("https://test", { method: "POST", headers: { "Idempotency-Key": "test-payment-key-000001" } });
    await expect(requestPayment(request, { ...env, ORDER_NOTIFY_SECRET: "" } as any, created.orderId, "bigdata")).rejects.toMatchObject({ code: "ORDER_NOTIFICATION_NOT_CONFIGURED" });
  });
});
