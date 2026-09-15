ALTER TABLE products ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1));
CREATE INDEX idx_products_test_flag ON products(is_test, active);
