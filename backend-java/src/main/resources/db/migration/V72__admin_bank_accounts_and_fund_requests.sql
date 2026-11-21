-- =============================================================================
-- Migration V72: Admin Bank Account Management & Manual Fund Request Module
-- =============================================================================

-- 1. Table: admin_bank_accounts
CREATE TABLE IF NOT EXISTS admin_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_holder_name VARCHAR(150) NOT NULL,
    account_number_encrypted VARCHAR(512) NOT NULL,
    account_number_masked VARCHAR(30) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    branch VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_bank_accounts_is_active ON admin_bank_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_bank_accounts_created_at ON admin_bank_accounts(created_at DESC);

-- 2. Table: admin_bank_account_audit_logs
CREATE TABLE IF NOT EXISTS admin_bank_account_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES admin_bank_accounts(id) ON DELETE CASCADE,
    action_type VARCHAR(30) NOT NULL, -- CREATED, UPDATED, ACTIVATED, DEACTIVATED
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_audit_bank_id ON admin_bank_account_audit_logs(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_audit_created_at ON admin_bank_account_audit_logs(created_at DESC);

-- 3. Enhance existing fund_requests table with receiving bank snapshot and upload proof metadata
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES admin_bank_accounts(id) ON DELETE RESTRICT;
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS receiving_account_holder VARCHAR(150);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS receiving_bank_name VARCHAR(100);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS receiving_account_masked VARCHAR(30);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS receiving_ifsc VARCHAR(20);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS receiving_branch VARCHAR(150);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS user_role VARCHAR(30);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS payment_bank VARCHAR(100);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS payment_date_time TIMESTAMPTZ;
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS user_note VARCHAR(500);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS proof_storage_path VARCHAR(255);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS proof_original_filename VARCHAR(255);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS proof_content_type VARCHAR(50);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS proof_file_size BIGINT;
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500);
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_fund_requests_bank_account_id ON fund_requests(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_fund_requests_user_status ON fund_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fund_requests_created_at_desc ON fund_requests(created_at DESC);

-- 4. Table: fund_request_audit_logs
CREATE TABLE IF NOT EXISTS fund_request_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_request_id UUID NOT NULL REFERENCES fund_requests(id) ON DELETE CASCADE,
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(30) NOT NULL, -- SUBMITTED, APPROVED, REJECTED
    action_reason VARCHAR(500),
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fr_audit_request_id ON fund_request_audit_logs(fund_request_id);
CREATE INDEX IF NOT EXISTS idx_fr_audit_created_at ON fund_request_audit_logs(created_at DESC);
