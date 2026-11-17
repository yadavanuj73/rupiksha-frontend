-- Migration V64: Production Payout Security Hardening, Idempotency & Financial Audit Trail

-- 1. Extend payout_transactions with idempotency and reconciliation tracking
ALTER TABLE payout_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
ALTER TABLE payout_transactions ADD COLUMN IF NOT EXISTS request_payload_hash VARCHAR(64);
ALTER TABLE payout_transactions ADD COLUMN IF NOT EXISTS provider_txn_id VARCHAR(100);
ALTER TABLE payout_transactions ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) DEFAULT 'NONE';
ALTER TABLE payout_transactions ADD COLUMN IF NOT EXISTS refund_reference VARCHAR(100);
ALTER TABLE payout_transactions ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP;

-- 2. Add Unique constraint on idempotency_key (ignoring nulls for backward compatibility with legacy rows)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_idempotency_key 
    ON payout_transactions(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- 3. Add Index for status reconciliation lookups
CREATE INDEX IF NOT EXISTS idx_payout_status_created 
    ON payout_transactions(status, created_at);

-- 4. Create immutable payout_status_history audit table
CREATE TABLE IF NOT EXISTS payout_status_history (
    id BIGSERIAL PRIMARY KEY,
    payout_transaction_id BIGINT NOT NULL REFERENCES payout_transactions(id) ON DELETE CASCADE,
    order_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    provider_status VARCHAR(50),
    provider_txn_id VARCHAR(100),
    utr VARCHAR(100),
    amount DECIMAL(10, 2),
    charge_amount DECIMAL(10, 2),
    total_deducted DECIMAL(10, 2),
    acting_principal VARCHAR(100),
    remarks VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payout_history_order_id ON payout_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_payout_history_txn_id ON payout_status_history(payout_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payout_history_user_id ON payout_status_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_history_created ON payout_status_history(created_at);

COMMENT ON TABLE payout_status_history IS 'Immutable financial audit log of every payout state transition and reconciliation event';
