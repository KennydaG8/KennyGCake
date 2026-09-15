const API_ORIGIN = "https://kennygcake-group-buy-api-production.kennygcake-group-buy-backend.workers.dev";
const CAMPAIGN_ID = "onsite-pay";

async function api(path, init = {}) {
  const response = await fetch(`${API_ORIGIN}${path}`, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.code || `HTTP_${response.status}`);
  return body;
}

export const loadCampaign = () => api(`/v1/campaigns/${CAMPAIGN_ID}`, { cache: "no-store" });
export const createOrder = (body) => api(`/v1/campaigns/${CAMPAIGN_ID}/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const requestPayment = (orderId) => api(`/v1/campaigns/${CAMPAIGN_ID}/orders/${encodeURIComponent(orderId)}/payments`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID().replaceAll("-", "") } });
