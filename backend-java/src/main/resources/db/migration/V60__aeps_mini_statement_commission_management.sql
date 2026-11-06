-- ==============================================================================
-- Migration V60: AEPS 1 Mini Statement Commission Management System
-- ==============================================================================

-- 1. Create AEPS Mini Statement Commission Configurations Table
CREATE TABLE IF NOT EXISTS aeps_mini_statement_commission_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type VARCHAR(40) NOT NULL DEFAULT 'AEPS_1_MINI_STATEMENT',
    plan_id UUID NOT NULL REFERENCES commission_plans(id) ON DELETE CASCADE,
    plan_code VARCHAR(50) NOT NULL,
    retailer_commission NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    distributor_commission NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    super_distributor_commission NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_aeps_ms_plan UNIQUE (plan_id),
    CONSTRAINT chk_aeps_ms_ret_comm CHECK (retailer_commission >= 0),
    CONSTRAINT chk_aeps_ms_dist_comm CHECK (distributor_commission >= 0),
    CONSTRAINT chk_aeps_ms_sd_comm CHECK (super_distributor_commission >= 0)
);

CREATE INDEX IF NOT EXISTS idx_aeps_ms_comm_plan_id ON aeps_mini_statement_commission_configs(plan_id);
CREATE INDEX IF NOT EXISTS idx_aeps_ms_comm_enabled ON aeps_mini_statement_commission_configs(enabled);

-- 2. Create AEPS Mini Statement Commission Configuration Audit Table
CREATE TABLE IF NOT EXISTS aeps_mini_statement_commission_config_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES aeps_mini_statement_commission_configs(id) ON DELETE SET NULL,
    service_type VARCHAR(40) NOT NULL DEFAULT 'AEPS_1_MINI_STATEMENT',
    plan_code VARCHAR(50) NOT NULL,
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_username VARCHAR(100),
    prev_retailer_commission NUMERIC(18, 2),
    prev_distributor_commission NUMERIC(18, 2),
    prev_super_distributor_commission NUMERIC(18, 2),
    prev_enabled BOOLEAN,
    new_retailer_commission NUMERIC(18, 2),
    new_distributor_commission NUMERIC(18, 2),
    new_super_distributor_commission NUMERIC(18, 2),
    new_enabled BOOLEAN,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aeps_ms_audit_plan ON aeps_mini_statement_commission_config_audits(plan_code);
CREATE INDEX IF NOT EXISTS idx_aeps_ms_audit_created ON aeps_mini_statement_commission_config_audits(created_at DESC);

-- 3. Seed Initial Flat Rupee Commission Configurations for AEPS 1 Mini Statement
--    Linked to the 4 existing AEPS_1 membership plans (FREE, PLAN_2999, PLAN_4999, PLAN_7999)
DO $$
DECLARE
    plan_rec RECORD;
BEGIN
    FOR plan_rec IN SELECT id, plan_code FROM commission_plans WHERE service_type = 'AEPS_1' LOOP
        INSERT INTO aeps_mini_statement_commission_configs (
            service_type, plan_id, plan_code,
            retailer_commission, distributor_commission, super_distributor_commission, enabled
        ) VALUES (
            'AEPS_1_MINI_STATEMENT', plan_rec.id, plan_rec.plan_code,
            CASE
                WHEN plan_rec.plan_code = 'FREE' THEN 1.00
                WHEN plan_rec.plan_code = 'PLAN_2999' THEN 1.25
                WHEN plan_rec.plan_code = 'PLAN_4999' THEN 1.50
                WHEN plan_rec.plan_code = 'PLAN_7999' THEN 2.00
                ELSE 1.00
            END,
            0.50,
            0.25,
            TRUE
        ) ON CONFLICT (plan_id) DO NOTHING;
    END LOOP;
END $$;

