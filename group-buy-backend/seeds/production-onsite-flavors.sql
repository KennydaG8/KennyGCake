INSERT INTO campaign_products (campaign_id, product_id, unit_price, display_order, active)
VALUES
  ('onsite-pay', 'sunmoonlake-black-tea', 85, 4, 1),
  ('onsite-pay', 'gukeng-jiabishan-coffee', 85, 5, 1)
ON CONFLICT(campaign_id, product_id) DO UPDATE SET
  unit_price = excluded.unit_price,
  display_order = excluded.display_order,
  active = 1;

UPDATE campaigns
SET bundle_quantity = 2,
    bundle_price = 150,
    updated_at = datetime('now')
WHERE id = 'onsite-pay';
