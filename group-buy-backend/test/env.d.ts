declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      CAMPAIGN_TOKEN_PEPPER: string;
      ALLOWED_ORIGINS: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
export {};
