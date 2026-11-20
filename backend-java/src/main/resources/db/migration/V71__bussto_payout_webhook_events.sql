-- Migration V71: Bussto Payout Webhook Events, Idempotency & Audit Trail

-- 1. Create payout_webhook_events table
CREATE TABLE IF NOT EXISTS payout_webhook_events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(100),
    order_id VARCHAR(100),
    provider_txn_id VARCHAR(100),
    payload_hash VARCHAR(64) NOT NULL,
    provider_status VARCHAR(50),
    mapped_status VARCHAR(50),
    verification_method VARCHAR(50),
    verification_result VARCHAR(50),
    processing_status VARCHAR(50) NOT NULL,
    http_status_code INT NOT NULL DEFAULT 200,
    error_message VARCHAR(1000),
    raw_payload TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payout_webhook_order_id ON payout_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payout_webhook_event_id ON payout_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_payout_webhook_payload_hash ON payout_webhook_events(payload_hash);
CREATE INDEX IF NOT EXISTS idx_payout_webhook_created_at ON payout_webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_payout_webhook_processing_status ON payout_webhook_events(processing_status);

-- 2. Ensure provider_txn_id on payout_transactions is indexed for fast webhook matching
CREATE INDEX IF NOT EXISTS idx_payout_provider_txn_id ON payout_transactions(provider_txn_id);

COMMENT ON TABLE payout_webhook_events IS 'Idempotent audit log of all incoming Bussto payout webhook callbacks and processing telemetry';
