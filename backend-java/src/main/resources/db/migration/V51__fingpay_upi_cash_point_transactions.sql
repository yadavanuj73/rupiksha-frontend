-- V51: Fingpay UPI Cash Point (UPI Cash Withdrawal) transactions, merchant mapping, and performance indexes

-- Add optional UPI Cash Withdrawal merchant override columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS upicw_merchant_id VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS upicw_merchant_pin VARCHAR(80);
CREATE INDEX IF NOT EXISTS idx_users_upicw_merchant_id ON users(upicw_merchant_id);

-- Create table for durable, idempotent Fingpay UPI Cash Withdrawal transactions
CREATE TABLE IF NOT EXISTS fingpay_upi_cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    txn_id UUID REFERENCES transactions(id),
    partner_request_id VARCHAR(100) UNIQUE NOT NULL,
    fp_transaction_id VARCHAR(100),
    bc_login_id VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    transaction_type VARCHAR(50) DEFAULT 'UPICW',
    provider_status VARCHAR(50),
    internal_status VARCHAR(50) NOT NULL, -- INITIATED, QR_GENERATED, PENDING, SUCCESS, FAILED, EXPIRED
    intent_link TEXT,
    vpa VARCHAR(120),
    bank_rrn VARCHAR(100),
    payer_name VARCHAR(150),
    payer_vpa VARCHAR(150),
    payer_amount NUMERIC(15, 2),
    qr_expiry_date TIMESTAMP WITH TIME ZONE,
    qr_expiry_in INTEGER,
    qr_expiry_note VARCHAR(500),
    status_check_attempts INTEGER DEFAULT 3,
    status_check_gap INTEGER DEFAULT 30,
    status_check_start_in INTEGER DEFAULT 60,
    response_code VARCHAR(50),
    response_message VARCHAR(500),
    error_message VARCHAR(500),
    remarks TEXT,
    bc_latitude NUMERIC(10, 6),
    bc_longitude NUMERIC(10, 6),
    wallet_entry_id UUID,
    reconciled BOOLEAN DEFAULT FALSE,
    recon_reference_id VARCHAR(100),
    recon_response_code VARCHAR(50),
    recon_message VARCHAR(255),
    raw_initiate_response TEXT,
    raw_callback_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for fast lookup, history, and reconciliation
CREATE INDEX IF NOT EXISTS idx_fp_upicw_user_id ON fingpay_upi_cash_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_fp_upicw_partner_req_id ON fingpay_upi_cash_transactions(partner_request_id);
CREATE INDEX IF NOT EXISTS idx_fp_upicw_fp_txn_id ON fingpay_upi_cash_transactions(fp_transaction_id);
CREATE INDEX IF NOT EXISTS idx_fp_upicw_bank_rrn ON fingpay_upi_cash_transactions(bank_rrn);
CREATE INDEX IF NOT EXISTS idx_fp_upicw_bc_login_id ON fingpay_upi_cash_transactions(bc_login_id);
CREATE INDEX IF NOT EXISTS idx_fp_upicw_status ON fingpay_upi_cash_transactions(internal_status);
CREATE INDEX IF NOT EXISTS idx_fp_upicw_created_at ON fingpay_upi_cash_transactions(created_at);
