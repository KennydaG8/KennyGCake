-- Company order page (kennygcake.com/order/): prepaid LINE Pay orders that Kenny delivers.
ALTER TABLE campaigns ADD COLUMN requires_delivery INTEGER NOT NULL DEFAULT 0 CHECK (requires_delivery IN (0, 1));
ALTER TABLE campaigns ADD COLUMN min_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity >= 1);

ALTER TABLE orders ADD COLUMN email TEXT;
ALTER TABLE orders ADD COLUMN delivery_date TEXT;
ALTER TABLE orders ADD COLUMN delivery_slot TEXT;
ALTER TABLE orders ADD COLUMN delivery_address TEXT;
ALTER TABLE orders ADD COLUMN notified_at TEXT;
ALTER TABLE orders ADD COLUMN notify_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_orders_unnotified ON orders(payment_status, notified_at, paid_at);
