ALTER TABLE payment_attempts ADD COLUMN payment_url_web TEXT;
ALTER TABLE payment_attempts ADD COLUMN expires_at TEXT;
ALTER TABLE payment_attempts ADD COLUMN provider_return_code TEXT;
ALTER TABLE payment_attempts ADD COLUMN failure_reason TEXT;

CREATE UNIQUE INDEX idx_payment_attempts_active_order
ON payment_attempts(order_id)
WHERE status IN ('CREATED', 'REQUESTED', 'AUTHORIZED');

CREATE INDEX idx_payment_attempts_expiry ON payment_attempts(status, expires_at);
