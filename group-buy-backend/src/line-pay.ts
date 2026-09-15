import type { Env } from "./types";

const ALLOWED_BASES = new Set(["https://sandbox-api-pay.line.me", "https://api-pay.line.me"]);
const encoder = new TextEncoder();

export interface LinePayResult { returnCode: string; returnMessage: string; info?: Record<string, any> }

function parseLargeIntegers(text: string): LinePayResult {
  return JSON.parse(text.replace(/:\s*(\d{16,})\b/g, ':"$1"')) as LinePayResult;
}

async function signature(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return btoa(String.fromCharCode(...bytes));
}

export async function linePay(env: Env, method: "GET" | "POST", path: string, data?: unknown, query = ""): Promise<LinePayResult> {
  if (!env.LINE_PAY_CHANNEL_ID || !env.LINE_PAY_CHANNEL_SECRET) throw new Error("LINE Pay credentials are not configured");
  const baseUrl = env.LINE_PAY_API_BASE_URL?.replace(/\/$/, "");
  if (!ALLOWED_BASES.has(baseUrl)) throw new Error("LINE Pay API environment is not explicitly configured");
  const nonce = crypto.randomUUID();
  const body = data === undefined ? "" : JSON.stringify(data);
  const material = env.LINE_PAY_CHANNEL_SECRET + path + (method === "GET" ? query : body) + nonce;
  const response = await fetch(`${baseUrl}${path}${query}`, {
    method,
    headers: { "Content-Type": "application/json", "X-LINE-ChannelId": env.LINE_PAY_CHANNEL_ID, "X-LINE-Authorization-Nonce": nonce, "X-LINE-Authorization": await signature(env.LINE_PAY_CHANNEL_SECRET, material) },
    body: method === "POST" ? body : undefined,
  });
  if (!response.ok) throw new Error(`LINE Pay HTTP ${response.status}`);
  return parseLargeIntegers(await response.text());
}
