import { ApiError } from "./http";
import type { CampaignRow, ProductRow, RequestedItem } from "./types";

export async function getCampaign(db: D1Database, campaignId: string): Promise<CampaignRow | null> {
  return db.prepare("SELECT id, company_name, campaign_name, visibility, status, access_token_digest, order_deadline, delivery_date, delivery_start_time, delivery_end_time, delivery_method, delivery_fee, free_delivery_threshold, note, is_test, bundle_quantity, bundle_price, public_access FROM campaigns WHERE id = ?1").bind(campaignId).first<CampaignRow>();
}

export async function getCampaignProducts(db: D1Database, campaignId: string): Promise<ProductRow[]> {
  const result = await db.prepare("SELECT p.id, p.name, p.image_url, cp.unit_price, p.is_test FROM campaign_products cp JOIN products p ON p.id = cp.product_id WHERE cp.campaign_id = ?1 AND cp.active = 1 AND p.active = 1 ORDER BY cp.display_order, p.id").bind(campaignId).all<ProductRow>();
  return result.results;
}

export async function getProgress(db: D1Database, campaignId: string) {
  const row = await db.prepare("SELECT COUNT(*) AS paid_order_count, COALESCE(SUM(total_quantity), 0) AS paid_quantity, COALESCE(SUM(total_amount), 0) AS paid_amount FROM orders WHERE campaign_id = ?1 AND payment_status = 'PAID' AND is_test = 0").bind(campaignId).first<{ paid_order_count: number; paid_quantity: number; paid_amount: number }>();
  return { paidOrderCount: Number(row?.paid_order_count || 0), paidQuantity: Number(row?.paid_quantity || 0), paidAmount: Number(row?.paid_amount || 0) };
}

export async function calculateOrder(db: D1Database, campaignId: string, requested: RequestedItem[], gamePass = false) {
  const [catalog, pricing] = await Promise.all([
    getCampaignProducts(db, campaignId),
    db.prepare("SELECT bundle_quantity, bundle_price FROM campaigns WHERE id=?1").bind(campaignId).first<{bundle_quantity:number|null;bundle_price:number|null}>(),
  ]);
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const items = requested.map(({ productId, quantity }) => {
    const product = byId.get(productId);
    if (!product) throw new ApiError(422, "PRODUCT_UNAVAILABLE", `Product ${productId} is unavailable`);
    return { productId, name: product.name, quantity, unitPrice: Number(product.unit_price), subtotal: quantity * Number(product.unit_price), isTest: product.is_test === 1 };
  });
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const baseAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const hasTestItems = items.some((item) => item.isTest);
  const hasOfficialItems = items.some((item) => !item.isTest);
  if (hasTestItems && hasOfficialItems) throw new ApiError(422, "TEST_ITEM_MIXED", "Top-up item must be ordered separately");
  const bundleQuantity = Number(pricing?.bundle_quantity || 0);
  const bundlePrice = Number(pricing?.bundle_price ?? -1);
  let discount = 0;
  if (gamePass && hasTestItems) throw new ApiError(422, "GAME_PASS_NOT_APPLICABLE", "Game pass cannot be used for top-up items");
  if (gamePass && !hasTestItems) {
    const targetAmount = totalQuantity === 1 ? 75 : totalQuantity * 70;
    discount = Math.max(0, baseAmount - targetAmount);
  } else if (!hasTestItems && bundleQuantity >= 2 && bundlePrice >= 0) {
    const unitPrices = new Set(items.map((item) => item.unitPrice));
    if (unitPrices.size !== 1) throw new Error("Bundle pricing requires one catalog unit price");
    const unitPrice = items[0]?.unitPrice || 0;
    discount = Math.floor(totalQuantity / bundleQuantity) * Math.max(0, unitPrice * bundleQuantity - bundlePrice);
  }
  let remainingDiscount = discount;
  const discountedItems = items.map((item) => {
    const applied = Math.min(remainingDiscount, item.subtotal);
    remainingDiscount -= applied;
    return { ...item, subtotal: item.subtotal - applied };
  });
  return {
    items: discountedItems,
    totalQuantity,
    totalAmount: baseAmount - discount,
    isTest: items.some((item) => item.isTest) ? 1 : 0,
  };
}

interface PersistOrderInput {
  id: string;
  campaignId: string;
  companyName: string;
  isTest: number;
  customerName: string;
  phone: string;
  lineName: string | null;
  department: string | null;
  note: string | null;
  totalQuantity: number;
  totalAmount: number;
  items: Array<{ productId: string; name: string; quantity: number; unitPrice: number; subtotal: number; isTest?: boolean }>;
  now: string;
}

export async function persistPendingOrder(db: D1Database, input: PersistOrderInput): Promise<void> {
  const statements = [
    db.prepare("INSERT INTO orders (id, campaign_id, company_name_snapshot, customer_name, phone, line_name, department, note, total_quantity, total_amount, payment_method, payment_status, created_at, updated_at, is_test) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'LINE_PAY', 'PENDING', ?11, ?11, ?12)")
      .bind(input.id, input.campaignId, input.companyName, input.customerName, input.phone, input.lineName, input.department, input.note, input.totalQuantity, input.totalAmount, input.now, input.isTest),
    ...input.items.map((item) => db.prepare("INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, subtotal) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
      .bind(input.id, item.productId, item.name, item.quantity, item.unitPrice, item.subtotal)),
  ];
  await db.batch(statements);
}
