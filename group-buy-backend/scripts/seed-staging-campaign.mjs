import { createHmac, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Entry } from "@napi-rs/keyring";
import { promptSecret } from "./secure-prompt.mjs";

const pepper = await promptSecret("Enter the same staging CAMPAIGN_TOKEN_PEPPER (hidden): ");
if (Buffer.byteLength(pepper, "utf8") < 32) throw new Error("Pepper must contain at least 32 bytes");

const campaignId = "gongxin";
const token = randomBytes(32).toString("base64url");
const digest = createHmac("sha256", pepper).update(`campaign:${campaignId}:${token}`).digest("hex");
const now = new Date().toISOString();
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = [
  `INSERT INTO campaigns (id, company_name, campaign_name, visibility, status, access_token_digest, order_deadline, delivery_date, delivery_start_time, delivery_end_time, delivery_method, delivery_fee, free_delivery_threshold, note, created_at, updated_at) VALUES ('gongxin', ${quote("公信電子")}, ${quote("公信電子員工限定團購")}, 'UNLISTED', 'ACTIVE', '${digest}', '2026-12-31T15:59:59.000Z', '2027-01-15', '12:00', '13:00', ${quote("公司統一配送／員工現場領取")}, 0, 1000, ${quote("STAGING TEST DATA：商品為冷凍商品，請於指定時間內完成領取。")}, '${now}', '${now}')`,
  `INSERT INTO products (id, name, image_url, active, created_at, updated_at) VALUES ('original', ${quote("經典原味")}, '../images/basque-original-cut.png', 1, '${now}', '${now}'), ('matcha', ${quote("濃香抹茶")}, '../images/basque-matcha-cut.png', 1, '${now}', '${now}'), ('chocolate', ${quote("醇厚巧克力")}, '../images/basque-chocolate-cut.png', 1, '${now}', '${now}')`,
  "INSERT INTO campaign_products (campaign_id, product_id, unit_price, display_order, active) VALUES ('gongxin', 'original', 85, 1, 1), ('gongxin', 'matcha', 85, 2, 1), ('gongxin', 'chocolate', 85, 3, 1)",
].join("; ");

const wranglerCli = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const result = spawnSync(
  process.execPath,
  [wranglerCli, "d1", "execute", "kennygcake-group-buy-staging", "--remote", "--config", "wrangler.staging.toml", "--command", sql],
  { encoding: "utf8", shell: false },
);

if (result.error || result.status !== 0) {
  // Wrangler can echo the SQL command in diagnostic output. Never print SQL here:
  // it contains the campaign token digest and other staging data.
  const diagnostic = `${result.stderr ?? ""}\n${result.stdout ?? ""}`
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /(?:D1_ERROR|SQLITE|error|failed)/iu.test(line))
    .filter((line) => !/(?:INSERT\s+INTO|--command|access_token_digest)/iu.test(line))
    .map((line) => line
      .replace(/\b[0-9a-f]{64}\b/giu, "[REDACTED_DIGEST]")
      .replace(/\b[A-Za-z0-9_-]{40,}\b/gu, "[REDACTED_VALUE]"));

  console.error(`Wrangler/D1 failed (exit code: ${result.status ?? "not started"}). Safe diagnostic output:`);
  if (result.error) {
    console.error(`${result.error.code ?? "SPAWN_ERROR"}: ${result.error.syscall ?? "Unable to start Wrangler"}`);
  }
  console.error(diagnostic.length > 0 ? [...new Set(diagnostic)].join("\n") : "No safe diagnostic line was available; inspect the Wrangler log path shown above.");
  throw new Error("Staging campaign insert failed; token was not stored");
}

new Entry("kennygcake-group-buy-staging", "gongxin-access-token").setPassword(token);
console.log("Staging campaign created. Plain token stored only in Windows Credential Manager.");
