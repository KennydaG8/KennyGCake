import { linePay } from "./line-pay";
import type { Env } from "./types";

const MAX_ATTEMPTS = 50;
const now = () => new Date().toISOString();
const message = (error: unknown) => error instanceof Error ? error.message : "unknown";
export const notifyConfigured = (env: Env) => Boolean(env.ORDER_NOTIFY_URL && env.ORDER_NOTIFY_SECRET && env.ORDER_PAGE_URL);

interface PaidOrder {
  id: string;
  campaign_id: string;
  company_name_snapshot: string;
  customer_name: string;
  phone: string;
  department: string | null;
  email: string | null;
  note: string | null;
  total_amount: number;
  delivery_date: string;
  delivery_slot: string;
  delivery_address: string;
  paid_at: string;
}

export async function markPaid(env: Env, attemptId: string, orderId: string): Promise<void> {
  const t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE payment_attempts SET status='CONFIRMED',confirmed_at=?1,updated_at=?1 WHERE id=?2 AND status!='CONFIRMED'").bind(t, attemptId),
    env.DB.prepare("UPDATE orders SET payment_status='PAID',paid_at=?1,updated_at=?1 WHERE id=?2 AND payment_status!='PAID'").bind(t, orderId),
  ]);
}

// Tells Kenny (Apps Script: sheet row + email) about a PAID delivery order.
// The receiver ignores an order ID it already has, so a retry cannot duplicate a row.
export async function notifyPaidOrder(env: Env, orderId: string): Promise<boolean> {
  if (!notifyConfigured(env)) return false;
  try {
    const order = await env.DB.prepare("SELECT o.id, o.campaign_id, o.company_name_snapshot, o.customer_name, o.phone, o.department, o.email, o.note, o.total_amount, o.delivery_date, o.delivery_slot, o.delivery_address, o.paid_at FROM orders o JOIN campaigns c ON c.id=o.campaign_id WHERE o.id=?1 AND o.payment_status='PAID' AND o.notified_at IS NULL AND c.requires_delivery=1").bind(orderId).first<PaidOrder>();
    if (!order) return false;
    await env.DB.prepare("UPDATE orders SET notify_attempts=notify_attempts+1 WHERE id=?1").bind(orderId).run();
    const items = (await env.DB.prepare("SELECT product_id AS id, quantity, unit_price AS unitPrice FROM order_items WHERE order_id=?1").bind(orderId).all()).results;
    const response = await fetch(env.ORDER_NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        paidSecret: env.ORDER_NOTIFY_SECRET,
        orderId: order.id,
        paidAt: order.paid_at,
        companyCode: order.campaign_id,
        companyName: order.company_name_snapshot,
        name: order.customer_name,
        phone: order.phone,
        department: order.department,
        email: order.email,
        note: order.note,
        items,
        totalAmount: order.total_amount,
        date: order.delivery_date,
        slot: order.delivery_slot,
        address: order.delivery_address,
      }),
    });
    const body = await response.json().catch(() => null) as { ok?: boolean; paid?: boolean } | null;
    // A receiver that does not know about payments answers ok without paid: keep retrying.
    if (!response.ok || !body?.ok || !body.paid) throw new Error("receiver did not accept the paid order");
    await env.DB.prepare("UPDATE orders SET notified_at=?1 WHERE id=?2").bind(now(), orderId).run();
    return true;
  } catch (error) {
    console.error("Paid order notification failed", orderId, message(error));
    return false;
  }
}

// Scheduled: finish payments whose confirm reply was lost, then retry notifications.
export async function sweep(env: Env): Promise<void> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const lost = await env.DB.prepare("SELECT DISTINCT a.id, a.order_id, a.provider_transaction_id FROM payment_attempts a JOIN orders o ON o.id=a.order_id JOIN campaigns c ON c.id=o.campaign_id JOIN payment_events e ON e.payment_attempt_id=a.id AND e.event_type='CONFIRM_STARTED' WHERE c.requires_delivery=1 AND o.payment_status!='PAID' AND a.status!='CONFIRMED' AND a.created_at>=?1 LIMIT 20").bind(since).all<{ id: string; order_id: string; provider_transaction_id: string }>();
  for (const a of lost.results) {
    try {
      const r = await linePay(env, "GET", `/v3/payments/requests/${a.provider_transaction_id}/check`);
      if (r.returnCode === "0123") await markPaid(env, a.id, a.order_id);
    } catch (error) {
      console.error("Payment reconcile failed", a.id, message(error));
    }
  }
  const pending = await env.DB.prepare("SELECT o.id FROM orders o JOIN campaigns c ON c.id=o.campaign_id WHERE c.requires_delivery=1 AND o.payment_status='PAID' AND o.notified_at IS NULL AND o.notify_attempts<?1 ORDER BY o.paid_at LIMIT 20").bind(MAX_ATTEMPTS).all<{ id: string }>();
  for (const o of pending.results) await notifyPaidOrder(env, o.id);
}
