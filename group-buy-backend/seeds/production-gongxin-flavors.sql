INSERT INTO products (id, name, image_url, active, created_at, updated_at, is_test)
VALUES
  ('sunmoonlake-black-tea', '南投魚池日月潭紅茶', 'https://kennygcake.com/images/basque-sunmoonlake-black-tea-cut.png', 1, '2026-09-16T00:00:00.000Z', '2026-09-16T00:00:00.000Z', 0),
  ('gukeng-jiabishan-coffee', '雲林古坑加比山咖啡', 'https://kennygcake.com/images/basque-gukeng-jiabishan-coffee-cut.png', 1, '2026-09-16T00:00:00.000Z', '2026-09-16T00:00:00.000Z', 0)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  image_url = excluded.image_url,
  active = 1,
  updated_at = excluded.updated_at,
  is_test = 0;

INSERT INTO campaign_products (campaign_id, product_id, unit_price, display_order, active)
VALUES
  ('gongxin', 'sunmoonlake-black-tea', 85, 4, 1),
  ('gongxin', 'gukeng-jiabishan-coffee', 85, 5, 1)
ON CONFLICT(campaign_id, product_id) DO UPDATE SET
  unit_price = excluded.unit_price,
  display_order = excluded.display_order,
  active = 1;
