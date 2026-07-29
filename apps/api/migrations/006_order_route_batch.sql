ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS route_batch_id UUID;

CREATE INDEX IF NOT EXISTS ix_orders_route_batch_id
    ON orders (route_batch_id);
