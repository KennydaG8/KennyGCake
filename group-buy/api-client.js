import { normalizeCampaign } from "./models.js";

const API_ORIGIN = "https://groupbuy-api.kennygcake.com";
const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);

export async function loadCampaign() {
  const params = new URLSearchParams(window.location.search);
  const campaignId = params.get("campaign");
  const accessToken = params.get("access");
  if (!campaignId) throw new Error("MISSING_CAMPAIGN");

  if (isLocalPreview) {
    if (campaignId !== "gongxin") throw new Error("CAMPAIGN_NOT_FOUND");
    const response = await fetch("./dev/gongxin-campaign.json", { cache: "no-store" });
    if (!response.ok) throw new Error("CAMPAIGN_LOAD_FAILED");
    return { campaign: normalizeCampaign(await response.json()), preview: true };
  }

  if (!accessToken || accessToken.length < 32) throw new Error("INVALID_ACCESS");
  const response = await fetch(`${API_ORIGIN}/v1/campaigns/${encodeURIComponent(campaignId)}`, {
    headers: { Authorization: `Campaign ${accessToken}` },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) throw new Error("INVALID_ACCESS");
  if (response.status === 404) throw new Error("CAMPAIGN_NOT_FOUND");
  if (!response.ok) throw new Error("CAMPAIGN_LOAD_FAILED");
  return { campaign: normalizeCampaign(await response.json()), preview: false };
}
