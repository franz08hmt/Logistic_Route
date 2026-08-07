CREATE TABLE IF NOT EXISTS customer_notifications (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    recipient_phone VARCHAR(30) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'ZALO_ZNS',
    template_code VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message_content TEXT NOT NULL,
    tracking_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_customer_notifications_order_id
    ON customer_notifications (order_id);
CREATE INDEX IF NOT EXISTS ix_customer_notifications_sent_at
    ON customer_notifications (sent_at);
