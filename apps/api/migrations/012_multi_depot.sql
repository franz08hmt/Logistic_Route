ALTER TABLE depots ADD COLUMN IF NOT EXISTS code VARCHAR(20);
ALTER TABLE depots ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE depots ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

UPDATE depots
SET code = 'HUB-SGN',
    city = 'TP. Hồ Chí Minh',
    is_default = TRUE
WHERE id = (SELECT id FROM depots ORDER BY id LIMIT 1)
  AND code IS NULL;

UPDATE depots
SET code = 'HUB-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8)),
    city = COALESCE(city, 'Chưa phân vùng')
WHERE code IS NULL;

ALTER TABLE depots ALTER COLUMN code SET NOT NULL;
ALTER TABLE depots ALTER COLUMN city SET NOT NULL;
ALTER TABLE depots ALTER COLUMN is_default SET NOT NULL;
UPDATE depots
SET is_default = TRUE
WHERE id = (SELECT id FROM depots ORDER BY code, id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM depots WHERE is_default = TRUE);
WITH selected_default AS (
    SELECT id FROM depots WHERE is_default = TRUE ORDER BY code, id LIMIT 1
)
UPDATE depots
SET is_default = FALSE
WHERE is_default = TRUE
  AND id <> (SELECT id FROM selected_default);
CREATE UNIQUE INDEX IF NOT EXISTS ix_depots_code ON depots (code);
CREATE INDEX IF NOT EXISTS ix_depots_is_default ON depots (is_default);
CREATE UNIQUE INDEX IF NOT EXISTS uq_depots_single_default
ON depots ((is_default)) WHERE is_default = TRUE;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS depot_id UUID REFERENCES depots(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS depot_id UUID REFERENCES depots(id) ON DELETE SET NULL;
ALTER TABLE route_analytics_snapshots ADD COLUMN IF NOT EXISTS depot_id UUID REFERENCES depots(id) ON DELETE SET NULL;

UPDATE vehicles
SET depot_id = (SELECT id FROM depots ORDER BY is_default DESC, code LIMIT 1)
WHERE depot_id IS NULL;

UPDATE orders
SET depot_id = (SELECT id FROM depots ORDER BY is_default DESC, code LIMIT 1)
WHERE depot_id IS NULL;

UPDATE route_analytics_snapshots
SET depot_id = (SELECT id FROM depots ORDER BY is_default DESC, code LIMIT 1)
WHERE depot_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_vehicles_depot_id ON vehicles (depot_id);
CREATE INDEX IF NOT EXISTS ix_orders_depot_id ON orders (depot_id);
CREATE INDEX IF NOT EXISTS ix_route_analytics_snapshots_depot_id ON route_analytics_snapshots (depot_id);
