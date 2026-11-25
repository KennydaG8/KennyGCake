// Creates one random secret, stores it in the production Worker as ORDER_NOTIFY_SECRET and puts it
// on the Windows clipboard so it can be pasted into the Apps Script property PAID_SECRET.
// The value is never printed. Run again to replace it (then paste the new value into Apps Script too).
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(backend, "node_modules", "wrangler", "bin", "wrangler.js");
const secret = randomBytes(32).toString("hex");

const put = spawnSync(process.execPath, [wrangler, "secret", "put", "ORDER_NOTIFY_SECRET", "-c", "wrangler.production.toml"], { cwd: backend, input: secret, stdio: ["pipe", "inherit", "inherit"] });
if (put.status !== 0) {
  console.error("\n設定失敗，密碼沒有複製。");
  process.exit(1);
}
const clip = spawnSync("clip", { input: secret });
if (clip.status !== 0) {
  console.error("\nCloudflare 已設定，但複製到剪貼簿失敗。請再執行一次。");
  process.exit(1);
}
console.log("\n完成。密碼已複製，請直接貼到 Apps Script 的指令碼屬性 PAID_SECRET。");
