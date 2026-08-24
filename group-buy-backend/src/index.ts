import { ApiError, corsPreflight, json } from "./http";
import { campaignView, createPendingOrder, progressView } from "./service";
import type { Env } from "./types";

const campaignRoute = /^\/v1\/campaigns\/([a-z0-9][a-z0-9_-]{0,63})$/;
const ordersRoute = /^\/v1\/campaigns\/([a-z0-9][a-z0-9_-]{0,63})\/orders$/;
const progressRoute = /^\/v1\/campaigns\/([a-z0-9][a-z0-9_-]{0,63})\/progress$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return corsPreflight(request, env);
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/health") return json(request, env, { status: "ok", service: "kennygcake-group-buy-api" });
      let match = campaignRoute.exec(url.pathname);
      if (request.method === "GET" && match) return json(request, env, await campaignView(request, env, match[1]));
      match = progressRoute.exec(url.pathname);
      if (request.method === "GET" && match) return json(request, env, await progressView(request, env, match[1]));
      match = ordersRoute.exec(url.pathname);
      if (request.method === "POST" && match) return json(request, env, await createPendingOrder(request, env, match[1]), 201);
      throw new ApiError(404, "NOT_FOUND", "Route was not found");
    } catch (error) {
      if (error instanceof ApiError) return json(request, env, { error: { code: error.code, message: error.message } }, error.status);
      console.error("Unhandled group-buy API error", error instanceof Error ? error.message : "unknown");
      return json(request, env, { error: { code: "INTERNAL_ERROR", message: "Request could not be completed" } }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
