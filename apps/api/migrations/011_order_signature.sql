ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS signature_url TEXT,
    ADD COLUMN IF NOT EXISTS signature_uploaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(150);
