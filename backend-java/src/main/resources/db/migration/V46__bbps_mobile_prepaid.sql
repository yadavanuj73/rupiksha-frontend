-- Migration V46: BBPS Mobile Prepaid Transactions and History
CREATE TABLE IF NOT EXISTS bbps_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    txn_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    request_id VARCHAR(40) NOT NULL UNIQUE,
    merchant_ref_no VARCHAR(64) NOT NULL UNIQUE,
    provider_txn_id VARCHAR(64),
    approval_ref_no VARCHAR(64),
    category VARCHAR(50) NOT NULL DEFAULT 'Mobile Prepaid',
    biller_id VARCHAR(32) NOT NULL,
    biller_name VARCHAR(100) NOT NULL,
    circle VARCHAR(100),
    mobile_number VARCHAR(20) NOT NULL,
    plan_id VARCHAR(64),
    plan_description TEXT,
    amount NUMERIC(18,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
    wallet_debit_ref VARCHAR(64),
    wallet_refund_ref VARCHAR(64),
    provider_response_code VARCHAR(20),
    provider_message VARCHAR(255),
    raw_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bbps_user_id ON bbps_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bbps_status ON bbps_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bbps_mobile ON bbps_transactions(mobile_number);
CREATE INDEX IF NOT EXISTS idx_bbps_created_at ON bbps_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bbps_provider_txn_id ON bbps_transactions(provider_txn_id);
CREATE INDEX IF NOT EXISTS idx_bbps_merchant_ref_no ON bbps_transactions(merchant_ref_no);
