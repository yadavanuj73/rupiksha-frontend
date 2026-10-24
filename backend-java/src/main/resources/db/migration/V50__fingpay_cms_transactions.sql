-- V50: Fingpay CMS (Cash Management Services) transactions, merchant mapping, and performance indexes

-- Add CMS merchant identification columns to users table for explicit provider mapping
ALTER TABLE users ADD COLUMN IF NOT EXISTS cms_merchant_id VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cms_merchant_pin VARCHAR(80);
CREATE INDEX IF NOT EXISTS idx_users_cms_merchant_id ON users(cms_merchant_id);

-- Create table for durable, idempotent Fingpay CMS transactions
CREATE TABLE IF NOT EXISTS fingpay_cms_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    txn_id UUID REFERENCES transactions(id),
    fp_transaction_id VARCHAR(100) UNIQUE NOT NULL,
    merchant_transaction_id VARCHAR(100) UNIQUE NOT NULL,
    bc_login_id VARCHAR(100) NOT NULL,
    type_of_transaction VARCHAR(50) DEFAULT 'CDC',
    amount NUMERIC(15, 2) NOT NULL,
    provider_status VARCHAR(10) NOT NULL, -- I, S, F
    internal_status VARCHAR(30) NOT NULL, -- INITIATED, SUCCESS, FAILED, REVERSED
    error_message VARCHAR(500),
    remarks TEXT,
    wallet_entry_id UUID,
    refund_wallet_entry_id UUID,
    callback_hash VARCHAR(255),
    raw_callback_payload TEXT,
    provider_timestamp VARCHAR(50),
    reconciled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_fp_cms_txns_user_id ON fingpay_cms_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_fp_cms_txns_fp_txn_id ON fingpay_cms_transactions(fp_transaction_id);
CREATE INDEX IF NOT EXISTS idx_fp_cms_txns_merchant_txn_id ON fingpay_cms_transactions(merchant_transaction_id);
CREATE INDEX IF NOT EXISTS idx_fp_cms_txns_bc_login_id ON fingpay_cms_transactions(bc_login_id);
CREATE INDEX IF NOT EXISTS idx_fp_cms_txns_status ON fingpay_cms_transactions(internal_status);
CREATE INDEX IF NOT EXISTS idx_fp_cms_txns_created_at ON fingpay_cms_transactions(created_at);
