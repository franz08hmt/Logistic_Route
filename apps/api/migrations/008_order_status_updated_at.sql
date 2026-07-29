ALTER TABLE orders
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

UPDATE orders
SET status_updated_at = pod_uploaded_at
WHERE status_updated_at IS NULL
  AND pod_uploaded_at IS NOT NULL;

ALTER TABLE orders
ALTER COLUMN status_updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS ix_orders_status_updated_at
ON orders (status_updated_at);
