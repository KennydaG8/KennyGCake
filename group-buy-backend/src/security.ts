import { ApiError } from "./http";

const encoder = new TextEncoder();

export function extractCampaignToken(request: Request): string {
  const header = request.headers.get("Authorization") || "";
  const match = /^Campaign ([A-Za-z0-9_-]{32,256})$/.exec(header);
  if (!match) throw new ApiError(401, "INVALID_ACCESS", "Campaign access token is missing or invalid");
  return match[1];
}

export async function campaignTokenDigest(campaignId: string, token: string, pepper: string): Promise<string> {
  if (!pepper || pepper.length < 32) throw new Error("CAMPAIGN_TOKEN_PEPPER must contain at least 32 characters");
  const key = await crypto.subtle.importKey("raw", encoder.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`campaign:${campaignId}:${token}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyCampaignToken(campaignId: string, token: string, pepper: string, storedHex: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(storedHex)) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signature = Uint8Array.from(storedHex.match(/.{2}/g) || [], (pair) => Number.parseInt(pair, 16));
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(`campaign:${campaignId}:${token}`));
}
