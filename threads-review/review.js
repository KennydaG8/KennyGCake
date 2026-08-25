const API_BASE = "https://kennygcake-threads-review-api.kennygcake-group-buy-backend.workers.dev";
const textOutput = (id, value) => { document.getElementById(id).textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); };
async function requestJson(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => ({ status: "NON_JSON_API_RESPONSE" }));
  return { http_status: response.status, ...body };
}
function element(name, content, className) {
  const node = document.createElement(name);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}
async function lookupProfile(username) {
  document.getElementById("username").value = username;
  textOutput("profile-result", "Loading…");
  try { textOutput("profile-result", await requestJson(`/profile?username=${encodeURIComponent(username)}`)); }
  catch { textOutput("profile-result", { status: "REVIEW_DEMO_API_UNAVAILABLE", message: "No mock result was used." }); }
  document.getElementById("username").scrollIntoView({ behavior: "smooth", block: "center" });
}
function renderSearch(body) {
  const container = document.getElementById("search-result");
  container.replaceChildren();
  const summary = element("div", `${body.result_count ?? 0} result(s) · HTTP ${body.http_status}`, "result");
  container.append(summary);
  if (!Array.isArray(body.results) || !body.results.length) {
    summary.textContent += `\n${body.error?.message || body.access_note || body.status || "No public posts returned."}`;
    return;
  }
  body.results.forEach(item => {
    const card = element("article", "", "result-card");
    card.append(element("strong", `@${item.username || "unknown"}`));
    card.append(element("p", item.text_excerpt || "No text excerpt"));
    card.append(element("small", `${item.timestamp || "timestamp unavailable"} · ${item.media_type || "media type unavailable"}`));
    const actions = element("div", "", "result-actions");
    if (item.permalink) {
      const link = element("a", "Open public post");
      link.href = item.permalink; link.target = "_blank"; link.rel = "noopener noreferrer";
      actions.append(link);
    }
    if (item.username) {
      const button = element("button", "View public profile");
      button.type = "button"; button.addEventListener("click", () => lookupProfile(item.username));
      actions.append(button);
    }
    card.append(actions); container.append(card);
  });
}
document.getElementById("search-button").addEventListener("click", async () => {
  const query = document.getElementById("query").value.trim();
  if (!query || query.length > 100) return renderSearch({ http_status: 400, status: "Enter 1–100 characters.", result_count: 0 });
  textOutput("search-result", "Loading…");
  try { renderSearch(await requestJson(`/search?q=${encodeURIComponent(query)}`)); }
  catch { renderSearch({ http_status: 503, status: "REVIEW_DEMO_API_UNAVAILABLE", result_count: 0 }); }
});
document.getElementById("profile-button").addEventListener("click", () => {
  const username = document.getElementById("username").value.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,50}$/.test(username)) return textOutput("profile-result", "Enter a valid public username.");
  lookupProfile(username);
});
requestJson("/status").then(body => textOutput("access-status", body)).catch(() => textOutput("access-status", { status: "REVIEW_DEMO_API_UNAVAILABLE" }));
