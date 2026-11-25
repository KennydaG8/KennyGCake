-- 大數據 同仁訂購頁 (kennygcake.com/order/?c=bigdata). Safe to run again.
-- access_token_digest is unused because public_access = 1; the page code is the link itself.
INSERT INTO campaigns (id, company_name, campaign_name, visibility, status, access_token_digest, delivery_method, delivery_fee, free_delivery_threshold, note, created_at, updated_at, public_access, requires_delivery, min_quantity)
VALUES ('bigdata', '大數據股份有限公司', '同仁專屬訂購', 'UNLISTED', 'ACTIVE', '0000000000000000000000000000000000000000000000000000000000000000', 'KennyG 親自配送', 0, 0, '', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), 1, 1, 12)
ON CONFLICT(id) DO UPDATE SET company_name = excluded.company_name, campaign_name = excluded.campaign_name, status = excluded.status, public_access = 1, requires_delivery = 1, min_quantity = 12, updated_at = excluded.updated_at;

INSERT INTO campaign_products (campaign_id, product_id, unit_price, display_order, active)
VALUES ('bigdata', 'original', 76, 1, 1), ('bigdata', 'matcha', 76, 2, 1), ('bigdata', 'chocolate', 76, 3, 1)
ON CONFLICT(campaign_id, product_id) DO UPDATE SET unit_price = excluded.unit_price, display_order = excluded.display_order, active = 1;
