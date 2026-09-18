declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      CAMPAIGN_TOKEN_PEPPER: string;
      ALLOWED_ORIGINS: string;
      LINE_PAY_CHANNEL_ID: string;
      LINE_PAY_CHANNEL_SECRET: string;
      LINE_PAY_API_BASE_URL: string;
      PAYMENT_ENABLED_CAMPAIGNS: string;
      PUBLIC_API_BASE_URL: string;
      ONSITE_GAME_PASSCODE: string;
      TEST_MIGRATIONS: D1Migration[];
      ASSETS: Fetcher;
    }
  }
}
export {};
