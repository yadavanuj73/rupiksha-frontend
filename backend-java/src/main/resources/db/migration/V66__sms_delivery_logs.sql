-- Migration V66: DoveSoft SMS Delivery Logs & Callback Traceability
CREATE TABLE IF NOT EXISTS sms_delivery_logs (
    id BIGSERIAL PRIMARY KEY,
    client_sms_id VARCHAR(64),
    provider_message_id VARCHAR(100),
    mobile_masked VARCHAR(20),
    sender_id VARCHAR(20),
    status VARCHAR(32) NOT NULL DEFAULT 'ACCEPTED',
    error_code VARCHAR(50),
    error_reason VARCHAR(255),
    delivery_time VARCHAR(100),
    raw_payload TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_client_id ON sms_delivery_logs(client_sms_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_msg_id ON sms_delivery_logs(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_delivery_logs(created_at);

COMMENT ON TABLE sms_delivery_logs IS 'Traceability log for outbound SMS dispatch and provider delivery callbacks';
