import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { calculateSelection, isOrderingOpen, normalizeCampaign } from "../group-buy/models.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("public homepage remains isolated from group buy", async () => {
  const home = await read("../index.html");
  assert.doesNotMatch(home, /group-buy/i);
  assert.doesNotMatch(home, /企業團購/);
  assert.doesNotMatch(home, /group-buy\.css|group-buy\.js/);
  assert.match(home, /GM2606291900051/);
});

test("group buy page is noindex and uses isolated assets", async () => {
  const page = await read("../group-buy/index.html");
  assert.match(page, /name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(page, /href="group-buy\.css"/);
  assert.match(page, /src="group-buy\.js"/);
  assert.doesNotMatch(page, /href="\.\.\/style\.css"/);
});

test("robots excludes the hidden group-buy route", async () => {
  assert.match(await read("../robots.txt"), /^Disallow: \/group-buy\/$/m);
});

test("campaign model calculates trusted catalog totals", async () => {
  const campaign = normalizeCampaign(JSON.parse(await read("../group-buy/dev/gongxin-campaign.json")));
  const result = calculateSelection(campaign, { original: 2, matcha: 1, chocolate: -4, unknown: 100 });
  assert.deepEqual(result, {
    items: [{ productId: "original", quantity: 2 }, { productId: "matcha", quantity: 1 }],
    totalQuantity: 3,
    totalAmount: 255,
  });
});

test("campaign status and deadline both close ordering", () => {
  const base = { status: "ACTIVE", orderDeadline: "2027-01-01T00:00:00+08:00" };
  assert.equal(isOrderingOpen(base, new Date("2026-12-01T00:00:00+08:00")), true);
  assert.equal(isOrderingOpen(base, new Date("2027-01-02T00:00:00+08:00")), false);
  assert.equal(isOrderingOpen({ ...base, status: "CLOSED" }, new Date("2026-12-01T00:00:00+08:00")), false);
});

test("development fixture has no access token or payment secret", async () => {
  const fixture = await read("../group-buy/dev/gongxin-campaign.json");
  assert.doesNotMatch(fixture, /accessToken|channelSecret|LINEPAY_CHANNEL/i);
});
