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
          TEST_MIGRATIONS: migrations,
        },
      },
    }),
  ],
});
