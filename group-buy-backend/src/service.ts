import { ApiError, readJson } from "./http";
import { calculateOrder, getCampaign, getCampaignProducts, getProgress, persistPendingOrder } from "./repository";
import { extractCampaignToken, verifyCampaignToken } from "./security";
import type { Env } from "./types";
import { validateOrderBody } from "./validation";

const validCampaignId = (value: string) => {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campaign was not found");
  return value;
};

async function validGamePasscode(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ (right[index] || 0);
  return difference === 0;
}

export async function authorizeCampaign(request: Request, env: Env, rawId: string) {
  const id = validCampaignId(rawId);
  const campaign = await getCampaign(env.DB, id);
  if (!campaign) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campaign was not found");
  if (campaign.public_access !== 1) {
    const token = extractCampaignToken(request);
    if (!await verifyCampaignToken(id, token, env.CAMPAIGN_TOKEN_PEPPER, campaign.access_token_digest)) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campaign was not found");
  }
  return campaign;
}

export function isDeadlinePassed(deadline: string | null, now: Date): boolean {
  if (!deadline) return false;
  const timestamp = Date.parse(deadline);
  return !Number.isFinite(timestamp) || now.getTime() >= timestamp;
}

export async function campaignView(request: Request, env: Env, campaignId: string) {
  const campaign = await authorizeCampaign(request, env, campaignId);
  const [products, progress] = await Promise.all([getCampaignProducts(env.DB, campaign.id), getProgress(env.DB, campaign.id)]);
  const deadlinePassed = isDeadlinePassed(campaign.order_deadline, new Date());
  return {
    id: campaign.id,
    companyName: campaign.company_name,
    campaignName: campaign.campaign_name,
    visibility: campaign.visibility,
    status: deadlinePassed && campaign.status === "ACTIVE" ? "CLOSED" : campaign.status,
    orderDeadline: campaign.order_deadline,
    deliveryDate: campaign.delivery_date,
    deliveryStartTime: campaign.delivery_start_time,
    deliveryEndTime: campaign.delivery_end_time,
    deliveryMethod: campaign.delivery_method,
    deliveryFee: campaign.delivery_fee,
    freeDeliveryThreshold: campaign.free_delivery_threshold,
    note: campaign.note,
    bundlePricing: campaign.bundle_quantity && campaign.bundle_price !== null ? { quantity: campaign.bundle_quantity, price: campaign.bundle_price } : null,
    products: products.map((product) => ({ id: product.id, name: product.name, imageUrl: product.image_url, unitPrice: Number(product.unit_price), active: true })),
    paidAmount: progress.paidAmount,
    progress: { ...progress, thresholdReached: progress.paidAmount >= campaign.free_delivery_threshold, remainingAmount: Math.max(0, campaign.free_delivery_threshold - progress.paidAmount) },
  };
}

export async function progressView(request: Request, env: Env, campaignId: string) {
  const campaign = await authorizeCampaign(request, env, campaignId);
  const progress = await getProgress(env.DB, campaign.id);
  return { campaignId: campaign.id, freeDeliveryThreshold: campaign.free_delivery_threshold, ...progress, thresholdReached: progress.paidAmount >= campaign.free_delivery_threshold, remainingAmount: Math.max(0, campaign.free_delivery_threshold - progress.paidAmount) };
}

export async function createPendingOrder(request: Request, env: Env, campaignId: string) {
  const campaign = await authorizeCampaign(request, env, campaignId);
  if (campaign.status !== "ACTIVE") throw new ApiError(409, "CAMPAIGN_NOT_ACTIVE", "Campaign does not accept new orders");
  if (isDeadlinePassed(campaign.order_deadline, new Date())) throw new ApiError(409, "CAMPAIGN_CLOSED", "Campaign deadline has passed");
  const customer = validateOrderBody(await readJson(request));
  const gamePass = customer.gamePasscode !== null;
  if (gamePass && (campaign.id !== "onsite-pay" || !await validGamePasscode(customer.gamePasscode!, env.ONSITE_GAME_PASSCODE))) {
    throw new ApiError(422, "INVALID_GAME_PASSCODE", "Game passcode is invalid");
  }
  const calculated = await calculateOrder(env.DB, campaign.id, customer.items, gamePass);
  const { gamePasscode: _discardedPasscode, ...persistedCustomer } = customer;
  const orderId = `KGC-${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
  const now = new Date().toISOString();
  await persistPendingOrder(env.DB, { id: orderId, campaignId: campaign.id, companyName: campaign.company_name, ...persistedCustomer, ...calculated, now });
  return { orderId, campaignId: campaign.id, paymentStatus: "PENDING", paymentMethod: "LINE_PAY", totalQuantity: calculated.totalQuantity, totalAmount: calculated.totalAmount, items: calculated.items, createdAt: now };
}
