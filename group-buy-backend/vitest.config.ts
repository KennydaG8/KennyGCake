import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations("./migrations");

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/index.ts",
      miniflare: {
        d1Databases: { DB: "group-buy-test" },
        bindings: {
          CAMPAIGN_TOKEN_PEPPER: "phase-two-test-pepper-value-with-at-least-32-characters",
          ALLOWED_ORIGINS: "https://kennygcake.com,http://127.0.0.1:4173",
          LINE_PAY_CHANNEL_ID: "sandbox-test-channel",
          LINE_PAY_CHANNEL_SECRET: "sandbox-test-secret-not-for-production",
          LINE_PAY_API_BASE_URL: "https://sandbox-api-pay.line.me",
          PAYMENT_ENABLED_CAMPAIGNS: "gongxin",
          PUBLIC_API_BASE_URL: "https://groupbuy-api.kennygcake.com",
          ONSITE_GAME_PASSCODE: "1234",
          TEST_MIGRATIONS: migrations,
        },
      },
    }),
  ],
});
