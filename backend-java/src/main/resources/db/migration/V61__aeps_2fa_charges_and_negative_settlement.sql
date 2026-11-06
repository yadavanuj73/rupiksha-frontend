-- ==============================================================================
-- Flyway Migration V61: AEPS 1 Daily 2FA Charges & Negative Wallet Settlement
-- Enterprise-grade, idempotent schema creation and initial plan seed data
-- ==============================================================================

-- 1. AEPS 1 2FA Charge Configuration Table
CREATE TABLE IF NOT EXISTS aeps_2fa_charge_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type VARCHAR(64) NOT NULL DEFAULT 'AEPS_1_2FA_CHARGE',
    plan_id UUID NOT NULL REFERENCES commission_plans(id) ON DELETE RESTRICT,
    plan_code VARCHAR(32) NOT NULL,
    retailer_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    distributor_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    super_distributor_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(64),
    updated_by VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_aeps_2fa_plan UNIQUE (plan_id),
    CONSTRAINT chk_aeps_2fa_ret_charge CHECK (retailer_charge >= 0),
    CONSTRAINT chk_aeps_2fa_dist_charge CHECK (distributor_charge >= 0),
    CONSTRAINT chk_aeps_2fa_sd_charge CHECK (super_distributor_charge >= 0)
);

CREATE INDEX IF NOT EXISTS idx_aeps_2fa_configs_plan_id ON aeps_2fa_charge_configs(plan_id);
CREATE INDEX IF NOT EXISTS idx_aeps_2fa_configs_plan_code ON aeps_2fa_charge_configs(plan_code);

-- 2. Audit Table for 2FA Charge Configuration Changes
CREATE TABLE IF NOT EXISTS aeps_2fa_charge_config_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES aeps_2fa_charge_configs(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL,
    plan_code VARCHAR(32) NOT NULL,
    admin_user_id UUID,
    admin_username VARCHAR(64) NOT NULL,
    prev_retailer_charge NUMERIC(10, 2),
    prev_distributor_charge NUMERIC(10, 2),
    prev_super_distributor_charge NUMERIC(10, 2),
    prev_enabled BOOLEAN,
    new_retailer_charge NUMERIC(10, 2) NOT NULL,
    new_distributor_charge NUMERIC(10, 2) NOT NULL,
    new_super_distributor_charge NUMERIC(10, 2) NOT NULL,
    new_enabled BOOLEAN NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aeps_2fa_audits_config_id ON aeps_2fa_charge_config_audits(config_id);
CREATE INDEX IF NOT EXISTS idx_aeps_2fa_audits_plan_id ON aeps_2fa_charge_config_audits(plan_id);
CREATE INDEX IF NOT EXISTS idx_aeps_2fa_audits_created_at ON aeps_2fa_charge_config_audits(created_at DESC);

-- 3. AEPS 1 2FA Charge Transaction Records Table
CREATE TABLE IF NOT EXISTS aeps_2fa_charge_txns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charge_reference VARCHAR(64) NOT NULL UNIQUE,
    original_2fa_reference VARCHAR(128) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    user_role VARCHAR(32) NOT NULL,
    plan_id UUID REFERENCES commission_plans(id) ON DELETE RESTRICT,
    plan_code VARCHAR(32) NOT NULL,
    configured_charge_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    amount_charged NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    wallet_opening_balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    wallet_closing_balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    outstanding_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    settlement_status VARCHAR(32) NOT NULL DEFAULT 'NONE',
    provider_transaction_reference VARCHAR(128),
    transaction_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_2fa_charge_orig_role_user UNIQUE (original_2fa_reference, user_role, user_id),
    CONSTRAINT chk_2fa_charge_amt CHECK (amount_charged >= 0),
    CONSTRAINT chk_2fa_outstanding_amt CHECK (outstanding_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_aeps_2fa_charge_txns_user ON aeps_2fa_charge_txns(user_id);
CREATE INDEX IF NOT EXISTS idx_aeps_2fa_charge_txns_orig ON aeps_2fa_charge_txns(original_2fa_reference);
CREATE INDEX IF NOT EXISTS idx_aeps_2fa_charge_txns_settle ON aeps_2fa_charge_txns(user_id, settlement_status, outstanding_amount);
CREATE INDEX IF NOT EXISTS idx_aeps_2fa_charge_txns_created ON aeps_2fa_charge_txns(created_at DESC);

-- 4. Outstanding Settlement Records Table
CREATE TABLE IF NOT EXISTS aeps_2fa_charge_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_reference VARCHAR(64) NOT NULL UNIQUE,
    charge_txn_id UUID NOT NULL REFERENCES aeps_2fa_charge_txns(id) ON DELETE RESTRICT,
    incoming_credit_reference VARCHAR(64) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    settlement_amount NUMERIC(10, 2) NOT NULL,
    remaining_outstanding_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    settlement_status VARCHAR(32) NOT NULL DEFAULT 'SETTLED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_2fa_settle_amt CHECK (settlement_amount > 0),
    CONSTRAINT chk_2fa_rem_outstanding CHECK (remaining_outstanding_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_aeps_2fa_settle_charge ON aeps_2fa_charge_settlements(charge_txn_id);
CREATE INDEX IF NOT EXISTS idx_aeps_2fa_settle_user ON aeps_2fa_charge_settlements(user_id);
CREATE INDEX IF NOT EXISTS idx_aeps_2fa_settle_created ON aeps_2fa_charge_settlements(created_at DESC);

-- 5. Seed Initial 2FA Charge Configurations for Existing AEPS 1 Plans
-- Matches the 4 AEPS 1 plans: FREE, PLAN_2999, PLAN_4999, PLAN_7999
INSERT INTO aeps_2fa_charge_configs (
    id, service_type, plan_id, plan_code,
    retailer_charge, distributor_charge, super_distributor_charge,
    enabled, created_by, updated_by, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    'AEPS_1_2FA_CHARGE',
    p.id,
    p.plan_code,
    CASE 
        WHEN p.plan_code = 'FREE' THEN 2.00
        WHEN p.plan_code = 'PLAN_2999' THEN 2.00
        WHEN p.plan_code = 'PLAN_4999' THEN 1.50
        WHEN p.plan_code = 'PLAN_7999' THEN 1.00
        ELSE 2.00
    END,
    CASE 
        WHEN p.plan_code = 'FREE' THEN 3.00
        WHEN p.plan_code = 'PLAN_2999' THEN 3.00
        WHEN p.plan_code = 'PLAN_4999' THEN 2.50
        WHEN p.plan_code = 'PLAN_7999' THEN 2.00
        ELSE 3.00
    END,
    CASE 
        WHEN p.plan_code = 'FREE' THEN 4.00
        WHEN p.plan_code = 'PLAN_2999' THEN 4.00
        WHEN p.plan_code = 'PLAN_4999' THEN 3.50
        WHEN p.plan_code = 'PLAN_7999' THEN 3.00
        ELSE 4.00
    END,
    true,
    'SYSTEM_INIT',
    'SYSTEM_INIT',
    NOW(),
    NOW()
FROM commission_plans p
WHERE p.service_type = 'AEPS_1'
ON CONFLICT (plan_id) DO NOTHING;

