export const CAMPAIGN_STATUSES = Object.freeze(["DRAFT", "ACTIVE", "CLOSED", "DELIVERED"]);

const requiredText = (value, field) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${field}`);
  return value.trim();
};

const nonNegativeInteger = (value, field) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${field}`);
  return value;
};

export function normalizeCampaign(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Invalid campaign");
  const status = requiredText(raw.status, "status");
  if (!CAMPAIGN_STATUSES.includes(status)) throw new Error("Invalid campaign status");
  const products = Array.isArray(raw.products) ? raw.products.map((product) => ({
    id: requiredText(product.id, "product.id"),
    name: requiredText(product.name, "product.name"),
    unitPrice: nonNegativeInteger(product.unitPrice, "product.unitPrice"),
    imageUrl: requiredText(product.imageUrl, "product.imageUrl"),
    active: product.active !== false,
  })).filter((product) => product.active) : [];
  if (!products.length) throw new Error("Campaign has no active products");

  return Object.freeze({
    id: requiredText(raw.id, "id"),
    companyName: requiredText(raw.companyName, "companyName"),
    campaignName: requiredText(raw.campaignName, "campaignName"),
    visibility: raw.visibility === "UNLISTED" ? "UNLISTED" : "UNLISTED",
    status,
    orderDeadline: raw.orderDeadline || null,
    deliveryDate: raw.deliveryDate || null,
    deliveryStartTime: raw.deliveryStartTime || null,
    deliveryEndTime: raw.deliveryEndTime || null,
    deliveryMethod: requiredText(raw.deliveryMethod, "deliveryMethod"),
    deliveryFee: nonNegativeInteger(raw.deliveryFee, "deliveryFee"),
    freeDeliveryThreshold: nonNegativeInteger(raw.freeDeliveryThreshold, "freeDeliveryThreshold"),
    note: typeof raw.note === "string" ? raw.note.trim() : "",
    paidAmount: nonNegativeInteger(raw.paidAmount ?? 0, "paidAmount"),
    products: Object.freeze(products),
  });
}

export function calculateSelection(campaign, quantities) {
  return campaign.products.reduce((summary, product) => {
    const quantity = Math.max(0, Number.isSafeInteger(quantities[product.id]) ? quantities[product.id] : 0);
    if (quantity) summary.items.push({ productId: product.id, quantity });
    summary.totalQuantity += quantity;
    summary.totalAmount += quantity * product.unitPrice;
    return summary;
  }, { items: [], totalQuantity: 0, totalAmount: 0 });
}

export function isOrderingOpen(campaign, now = new Date()) {
  if (campaign.status !== "ACTIVE") return false;
  return !campaign.orderDeadline || now < new Date(campaign.orderDeadline);
}
