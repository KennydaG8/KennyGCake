const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(body, status = 200, origin = "https://kennygcake.com") {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, "access-control-allow-origin": origin, vary: "Origin", "x-content-type-options": "nosniff" } });
}

function publicError(error, fallbackStatus = 502) {
  const meta = error?.error || {};
  return {
    status: "META_API_ERROR",
    error: {
      type: String(meta.type || "unknown"),
      code: Number.isFinite(meta.code) ? meta.code : null,
      subcode: Number.isFinite(meta.error_subcode) ? meta.error_subcode : null,
      message: String(meta.message || "Meta API request failed").slice(0, 300)
    },
    http_status: fallbackStatus
  };
}

async function graph(env, path, params = {}) {
  const url = new URL(`https://graph.threads.net/${env.THREADS_API_VERSION}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${env.THREADS_ACCESS_TOKEN}`, Accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function excerpt(text) { return String(text || "").replace(/\s+/g, " ").trim().slice(0, 280); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://kennygcake.com";
    if (request.method !== "GET") return json({ status: "METHOD_NOT_ALLOWED" }, 405, allowedOrigin);
    if (origin && origin !== allowedOrigin) return json({ status: "ORIGIN_NOT_ALLOWED" }, 403, allowedOrigin);
    if (!env.THREADS_ACCESS_TOKEN) return json({ status: "REVIEW_DEMO_NOT_CONFIGURED" }, 503, allowedOrigin);

    const clientKey = request.headers.get("CF-Connecting-IP") || "reviewer";
    if (env.RATE_LIMITER && !(await env.RATE_LIMITER.limit({ key: clientKey })).success) return json({ status: "RATE_LIMITED" }, 429, allowedOrigin);

    if (url.pathname === "/status") {
      const { response, body } = await graph(env, "me", { fields: "id,username" });
      if (!response.ok) return json(publicError(body, response.status), response.status, allowedOrigin);
      return json({ status: "READY", auth_ok: true, user_id_present: Boolean(body.id), username_present: Boolean(body.username), access_note: "Public results remain subject to the App's approved Meta access level." }, 200, allowedOrigin);
    }

    if (url.pathname === "/search") {
      const q = (url.searchParams.get("q") || "").trim();
      if (!q || q.length > 100) return json({ status: "INVALID_QUERY", message: "q must contain 1–100 characters" }, 400, allowedOrigin);
      const { response, body } = await graph(env, "keyword_search", { q, search_type: "RECENT", limit: "10", fields: "id,username,text,timestamp,media_type,permalink" });
      if (!response.ok) return json(publicError(body, response.status), response.status, allowedOrigin);
      const results = (body.data || []).slice(0, 10).map(item => ({ username: item.username || null, post_id: item.id || null, permalink: item.permalink || null, text_excerpt: excerpt(item.text), timestamp: item.timestamp || null, media_type: item.media_type || null }));
      return json({ status: "OK", query: q, result_count: results.length, results, has_next_page: Boolean(body.paging?.next), access_note: "Before Advanced Access, Meta may restrict results to app-role/authenticated users." }, 200, allowedOrigin);
    }

    if (url.pathname === "/profile") {
      const username = (url.searchParams.get("username") || "").trim().replace(/^@/, "");
      if (!/^[A-Za-z0-9._]{1,50}$/.test(username)) return json({ status: "INVALID_USERNAME" }, 400, allowedOrigin);
      const { response, body } = await graph(env, "profile_lookup", { username, fields: "id,username,name,biography,follower_count,is_verified" });
      if (!response.ok) return json(publicError(body, response.status), response.status, allowedOrigin);
      return json({ status: "OK", profile: { username: body.username || null, name: body.name || null, biography: body.biography || null, follower_count: Number.isFinite(body.follower_count) ? body.follower_count : null, is_verified: typeof body.is_verified === "boolean" ? body.is_verified : null, profile_url: body.username ? `https://www.threads.net/@${body.username}` : null }, access_note: "Only public profiles eligible under Meta's current access rules are returned." }, 200, allowedOrigin);
    }

    return json({ status: "NOT_FOUND" }, 404, allowedOrigin);
  }
};
