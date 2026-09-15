ALTER TABLE campaigns ADD COLUMN bundle_quantity INTEGER CHECK (bundle_quantity IS NULL OR bundle_quantity >= 2);
ALTER TABLE campaigns ADD COLUMN bundle_price INTEGER CHECK (bundle_price IS NULL OR bundle_price >= 0);
