PRAGMA foreign_keys = ON;

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'UNLISTED' CHECK (visibility = 'UNLISTED'),
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED', 'DELIVERED')),
  access_token_digest TEXT NOT NULL CHECK (length(access_token_digest) = 64),
  order_deadline TEXT,
  delivery_date TEXT,
  delivery_start_time TEXT,
  delivery_end_time TEXT,
  delivery_method TEXT NOT NULL,
  delivery_fee INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  free_delivery_threshold INTEGER NOT NULL DEFAULT 0 CHECK (free_delivery_threshold >= 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE campaign_products (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  display_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  PRIMARY KEY (campaign_id, product_id)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  company_name_snapshot TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line_name TEXT,
  department TEXT,
  note TEXT,
  total_quantity INTEGER NOT NULL CHECK (total_quantity > 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'LINE_PAY' CHECK (payment_method = 'LINE_PAY'),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
  created_at TEXT NOT NULL,
  paid_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  UNIQUE (order_id, product_id)
);

CREATE TABLE payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'LINE_PAY' CHECK (provider = 'LINE_PAY'),
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'REQUESTED', 'AUTHORIZED', 'CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED')),
  provider_transaction_id TEXT UNIQUE,
  requested_amount INTEGER NOT NULL CHECK (requested_amount >= 0),
  request_idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT
);

CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  payment_attempt_id TEXT NOT NULL REFERENCES payment_attempts(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  provider_transaction_id TEXT,
  provider_return_code TEXT,
  payload_digest TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_campaign_products_active ON campaign_products(campaign_id, active, display_order);
CREATE INDEX idx_orders_campaign_payment ON orders(campaign_id, payment_status, created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payment_attempts_order ON payment_attempts(order_id, created_at);
CREATE INDEX idx_payment_events_attempt ON payment_events(payment_attempt_id, created_at);
