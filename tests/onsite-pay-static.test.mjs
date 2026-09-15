import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pay/index.html", import.meta.url), "utf8");
const script = fs.readFileSync(new URL("../pay/pay.js", import.meta.url), "utf8");

test("onsite payment page does not collect personal data", () => {
  assert.doesNotMatch(html, /name="customerName"|name="phone"|name="note"/);
  assert.match(html, /不蒐集姓名、手機或其他個人資料/);
});

test("onsite payment creates an anonymous order", () => {
  assert.match(script, /customerName:"現場顧客",phone:"0900000000"/);
  assert.doesNotMatch(script, /FormData/);
});
