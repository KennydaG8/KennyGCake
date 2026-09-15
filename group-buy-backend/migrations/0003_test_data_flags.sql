ALTER TABLE campaigns ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1));
ALTER TABLE orders ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1));
CREATE INDEX idx_orders_test_flag ON orders(is_test, campaign_id, payment_status);
