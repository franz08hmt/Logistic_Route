-- Phase 15: COD collection, VietQR payments, and driver shift cash settlement.
--
-- Money is stored as NUMERIC(12, 0) because VND has no sub-unit in practice and
-- cash reconciliation must not inherit binary floating point rounding error.

CREATE TABLE IF NOT EXISTS driver_shift_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_code VARCHAR(50) UNIQUE NOT NULL,
    depot_id UUID NOT NULL REFERENCES depots(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    total_orders_count INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    total_cod_expected NUMERIC(12, 0) NOT NULL DEFAULT 0,
    expected_cash_amount NUMERIC(12, 0) NOT NULL DEFAULT 0,
    total_cash_collected NUMERIC(12, 0) NOT NULL DEFAULT 0,
    total_vietqr_collected NUMERIC(12, 0) NOT NULL DEFAULT 0,
    variance_amount NUMERIC(12, 0) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ NULL,
    approved_by_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT NULL,
    review_note TEXT NULL
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_amount NUMERIC(12, 0) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'COD_CASH';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_collected_at TIMESTAMPTZ NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_reconciled_at TIMESTAMPTZ NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_receipt_note TEXT NULL;

-- Binds every order to the shift settlement that hands its cash over, so the
-- cashier approval updates an explicit, auditable set instead of re-deriving
-- the shift from a timestamp window that races with in-flight deliveries.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_settlement_id UUID NULL
    REFERENCES driver_shift_settlements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_orders_cod_status ON orders (cod_status);
CREATE INDEX IF NOT EXISTS ix_orders_payment_method ON orders (payment_method);
CREATE INDEX IF NOT EXISTS ix_orders_shift_settlement_id ON orders (shift_settlement_id);
CREATE INDEX IF NOT EXISTS ix_driver_shift_settlements_scope
    ON driver_shift_settlements (depot_id, driver_id, status);
CREATE INDEX IF NOT EXISTS ix_driver_shift_settlements_submitted_at
    ON driver_shift_settlements (submitted_at);
