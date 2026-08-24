import { createHmac, randomBytes } from "node:crypto";

const campaignId = process.argv[2];
const pepper = process.env.CAMPAIGN_TOKEN_PEPPER;
if (!campaignId || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(campaignId)) throw new Error("Usage: CAMPAIGN_TOKEN_PEPPER=<secret> npm run token -- <campaign-id>");
if (!pepper || pepper.length < 32) throw new Error("CAMPAIGN_TOKEN_PEPPER must contain at least 32 characters");
const token = randomBytes(32).toString("base64url");
const digest = createHmac("sha256", pepper).update(`campaign:${campaignId}:${token}`).digest("hex");
console.log(JSON.stringify({ campaignId, accessToken: token, accessTokenDigest: digest }, null, 2));
