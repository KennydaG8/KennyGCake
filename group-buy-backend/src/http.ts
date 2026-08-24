import type { CreateOrderBody, Env } from "./types";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

export function json(request: Request, env: Env, data: unknown, status = 200): Response {
  const origin = allowedOrigin(request, env);
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function corsPreflight(request: Request, env: Env): Response {
  const origin = allowedOrigin(request, env);
  if (!origin) return json(request, env, { error: { code: "ORIGIN_NOT_ALLOWED" } }, 403);
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  }});
}

export async function readJson(request: Request): Promise<CreateOrderBody> {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected application/json");
  try { return await request.json() as CreateOrderBody; }
  catch { throw new ApiError(400, "INVALID_JSON", "Request body is not valid JSON"); }
}
