ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS current_latitude DOUBLE PRECISION;

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS current_longitude DOUBLE PRECISION;

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS current_speed_kmh DOUBLE PRECISION DEFAULT 0;

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS last_gps_ping_at TIMESTAMPTZ;

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS route_deviation_status VARCHAR(30) DEFAULT 'ON_ROUTE';

CREATE INDEX IF NOT EXISTS ix_vehicles_last_gps_ping_at
ON vehicles (last_gps_ping_at);
