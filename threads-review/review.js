const API_BASE = "https://kennygcake-threads-review-api.kennygcake-group-buy-backend.workers.dev";
const output = (id, value) => { document.getElementById(id).textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); };
async function request(path, target) {
  output(target, "Loading…");
  try {
    const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => ({ error: "Non-JSON API response" }));
    output(target, { http_status: response.status, ...body });
  } catch (error) {
    output(target, { status: "REVIEW_DEMO_API_UNAVAILABLE", message: "The isolated review backend is not enabled yet. No mock result was used." });
  }
}
document.getElementById("search-button").addEventListener("click", () => {
  const query = document.getElementById("query").value.trim();
  if (!query || query.length > 100) return output("search-result", "Enter 1–100 characters.");
  request(`/search?q=${encodeURIComponent(query)}`, "search-result");
});
document.getElementById("profile-button").addEventListener("click", () => {
  const username = document.getElementById("username").value.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,50}$/.test(username)) return output("profile-result", "Enter a valid public username.");
  request(`/profile?username=${encodeURIComponent(username)}`, "profile-result");
});
request("/status", "access-status");
