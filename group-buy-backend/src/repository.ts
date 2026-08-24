import { ApiError } from "./http";
import type { CampaignRow, ProductRow, RequestedItem } from "./types";

export async function getCampaign(db: D1Database, campaignId: string): Promise<CampaignRow | null> {
  return db.prepare("SELECT id, company_name, campaign_name, visibility, status, access_token_digest, order_deadline, delivery_date, delivery_start_time, delivery_end_time, delivery_method, delivery_fee, free_delivery_threshold, note FROM campaigns WHERE id = ?1").bind(campaignId).first<CampaignRow>();
}

export async function getCampaignProducts(db: D1Database, campaignId: string): Promise<ProductRow[]> {
  const result = await db.prepare("SELECT p.id, p.name, p.image_url, cp.unit_price FROM campaign_products cp JOIN products p ON p.id = cp.product_id WHERE cp.campaign_id = ?1 AND cp.active = 1 AND p.active = 1 ORDER BY cp.display_order, p.id").bind(campaignId).all<ProductRow>();
  return result.results;
}

export async function getProgress(db: D1Database, campaignId: string) {
  const row = await db.prepare("SELECT COUNT(*) AS paid_order_count, COALESCE(SUM(total_quantity), 0) AS paid_quantity, COALESCE(SUM(total_amount), 0) AS paid_amount FROM orders WHERE campaign_id = ?1 AND payment_status = 'PAID'").bind(campaignId).first<{ paid_order_count: number; paid_quantity: number; paid_amount: number }>();
  return { paidOrderCount: Number(row?.paid_order_count || 0), paidQuantity: Number(row?.paid_quantity || 0), paidAmount: Number(row?.paid_amount || 0) };
}

export async function calculateOrder(db: D1Database, campaignId: string, requested: RequestedItem[]) {
  const catalog = await getCampaignProducts(db, campaignId);
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const items = requested.map(({ productId, quantity }) => {
    const product = byId.get(productId);
    if (!product) throw new ApiError(422, "PRODUCT_UNAVAILABLE", `Product ${productId} is unavailable`);
    return { productId, name: product.name, quantity, unitPrice: Number(product.unit_price), subtotal: quantity * Number(product.unit_price) };
  });
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),
  };
}

interface PersistOrderInput {
  id: string;
  campaignId: string;
  companyName: string;
  customerName: string;
  phone: string;
  lineName: string | null;
  department: string | null;
  note: string | null;
  totalQuantity: number;
  totalAmount: number;
  items: Array<{ productId: string; name: string; quantity: number; unitPrice: number; subtotal: number }>;
  now: string;
}

export async function persistPendingOrder(db: D1Database, input: PersistOrderInput): Promise<void> {
  const statements = [
    db.prepare("INSERT INTO orders (id, campaign_id, company_name_snapshot, customer_name, phone, line_name, department, note, total_quantity, total_amount, payment_method, payment_status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'LINE_PAY', 'PENDING', ?11, ?11)")
      .bind(input.id, input.campaignId, input.companyName, input.customerName, input.phone, input.lineName, input.department, input.note, input.totalQuantity, input.totalAmount, input.now),
    ...input.items.map((item) => db.prepare("INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, subtotal) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
      .bind(input.id, item.productId, item.name, item.quantity, item.unitPrice, item.subtotal)),
  ];
  await db.batch(statements);
}
