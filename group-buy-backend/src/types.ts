export interface Env {
  DB: D1Database;
  CAMPAIGN_TOKEN_PEPPER: string;
  ALLOWED_ORIGINS: string;
  LINE_PAY_CHANNEL_ID: string;
  LINE_PAY_CHANNEL_SECRET: string;
  LINE_PAY_API_BASE_URL: string;
  PAYMENT_ENABLED_CAMPAIGNS: string;
  PUBLIC_API_BASE_URL: string;
  ONSITE_GAME_PASSCODE: string;
  ASSETS: Fetcher;
}

export type CampaignStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "DELIVERED";

export interface CampaignRow {
  id: string;
  company_name: string;
  campaign_name: string;
  visibility: "UNLISTED";
  status: CampaignStatus;
  access_token_digest: string;
  order_deadline: string | null;
  delivery_date: string | null;
  delivery_start_time: string | null;
  delivery_end_time: string | null;
  delivery_method: string;
  delivery_fee: number;
  free_delivery_threshold: number;
  note: string;
  is_test: number;
  bundle_quantity: number | null;
  bundle_price: number | null;
  public_access: number;
}

export interface ProductRow {
  id: string;
  name: string;
  image_url: string;
  unit_price: number;
  is_test: number;
}

export interface CreateOrderBody {
  customerName?: unknown;
  phone?: unknown;
  lineName?: unknown;
  department?: unknown;
  note?: unknown;
  gamePasscode?: unknown;
  items?: unknown;
}

export interface RequestedItem {
  productId: string;
  quantity: number;
}
