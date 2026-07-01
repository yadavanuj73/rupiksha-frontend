-- Alter wallets table
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS locked_balance NUMERIC(18,2) NOT NULL DEFAULT 0.00;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0;

-- Alter wallet_entries table
ALTER TABLE wallet_entries ALTER COLUMN entry_type TYPE VARCHAR(20);
ALTER TABLE wallet_entries ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18,2);
ALTER TABLE wallet_entries ADD COLUMN IF NOT EXISTS closing_balance NUMERIC(18,2);
ALTER TABLE wallet_entries ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE wallet_entries ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE wallet_entries ADD COLUMN IF NOT EXISTS gst NUMERIC(18,2) DEFAULT 0.00;
ALTER TABLE wallet_entries ADD COLUMN IF NOT EXISTS tds NUMERIC(18,2) DEFAULT 0.00;
ALTER TABLE wallet_entries ADD COLUMN IF NOT EXISTS platform_charges NUMERIC(18,2) DEFAULT 0.00;
ALTER TABLE wallet_entries ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'INITIATED';
ALTER TABLE wallet_entries ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80) UNIQUE;
ALTER TABLE wallet_entries ADD COLUMN IF NOT EXISTS transaction_context VARCHAR(50);

-- Create fund_requests table
CREATE TABLE IF NOT EXISTS fund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(18,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    utr_number VARCHAR(64),
    method VARCHAR(30) NOT NULL DEFAULT 'NEFT/IMPS',
    remark VARCHAR(255),
    admin_remark VARCHAR(255),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    old_balance NUMERIC(18,2) NOT NULL,
    new_balance NUMERIC(18,2) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    wallet_type VARCHAR(20) NOT NULL,
    ledger_type VARCHAR(30) NOT NULL,
    reference_number VARCHAR(64),
    transaction_id VARCHAR(64),
    ip_address VARCHAR(45),
    remark VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
