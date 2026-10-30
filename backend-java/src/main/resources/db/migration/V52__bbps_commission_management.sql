-- ==============================================================================
-- Migration V52: BBPS Percentage-Based Commission Management System
-- ==============================================================================

-- 1. Relax NOT NULL constraint on slab_min and slab_max in commission_transactions
--    to support percentage-based commission models that do not use transaction slabs.
ALTER TABLE commission_transactions 
    ALTER COLUMN slab_min DROP NOT NULL,
    ALTER COLUMN slab_max DROP NOT NULL;

-- 2. Add percentage and BBPS category audit columns to commission_transactions
ALTER TABLE commission_transactions
    ADD COLUMN IF NOT EXISTS applied_percentage NUMERIC(6, 4),
    ADD COLUMN IF NOT EXISTS commission_base_amount NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS bbps_category VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_comm_txn_bbps_category ON commission_transactions(bbps_category);

-- 3. Create BBPS Commission Configurations Table
CREATE TABLE IF NOT EXISTS bbps_commission_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id VARCHAR(64) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    commission_model VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
    plan_id UUID NOT NULL REFERENCES commission_plans(id) ON DELETE CASCADE,
    plan_code VARCHAR(50) NOT NULL,
    retailer_percentage NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    distributor_percentage NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    super_distributor_percentage NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bbps_comm_service_plan UNIQUE (service_id, plan_id),
    CONSTRAINT chk_bbps_ret_pct CHECK (retailer_percentage >= 0 AND retailer_percentage <= 100),
    CONSTRAINT chk_bbps_dist_pct CHECK (distributor_percentage >= 0 AND distributor_percentage <= 100),
    CONSTRAINT chk_bbps_sd_pct CHECK (super_distributor_percentage >= 0 AND super_distributor_percentage <= 100),
    CONSTRAINT chk_bbps_total_pct CHECK (retailer_percentage + distributor_percentage + super_distributor_percentage <= 100)
);

CREATE INDEX IF NOT EXISTS idx_bbps_comm_service_id ON bbps_commission_configs(service_id);
CREATE INDEX IF NOT EXISTS idx_bbps_comm_plan_id ON bbps_commission_configs(plan_id);
CREATE INDEX IF NOT EXISTS idx_bbps_comm_enabled ON bbps_commission_configs(enabled);

-- 4. Create BBPS Commission Configuration Audit Table
CREATE TABLE IF NOT EXISTS bbps_commission_config_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES bbps_commission_configs(id) ON DELETE SET NULL,
    service_id VARCHAR(64) NOT NULL,
    plan_code VARCHAR(50) NOT NULL,
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_username VARCHAR(100),
    prev_retailer_percentage NUMERIC(6, 4),
    prev_distributor_percentage NUMERIC(6, 4),
    prev_super_distributor_percentage NUMERIC(6, 4),
    prev_enabled BOOLEAN,
    new_retailer_percentage NUMERIC(6, 4),
    new_distributor_percentage NUMERIC(6, 4),
    new_super_distributor_percentage NUMERIC(6, 4),
    new_enabled BOOLEAN,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bbps_audit_service_id ON bbps_commission_config_audits(service_id);
CREATE INDEX IF NOT EXISTS idx_bbps_audit_created_at ON bbps_commission_config_audits(created_at DESC);

-- 5. Seed Initial Percentage Commission Configurations for BBPS -> Loan Repayment
--    Linking to the 4 existing AEPS_1 membership plans (Free, ₹2999, ₹4999, ₹7999)
DO $$
DECLARE
    plan_free_id UUID;
    plan_2999_id UUID;
    plan_4999_id UUID;
    plan_7999_id UUID;
BEGIN
    SELECT id INTO plan_free_id FROM commission_plans WHERE service_type = 'AEPS_1' AND plan_code = 'FREE';
    SELECT id INTO plan_2999_id FROM commission_plans WHERE service_type = 'AEPS_1' AND plan_code = 'PLAN_2999';
    SELECT id INTO plan_4999_id FROM commission_plans WHERE service_type = 'AEPS_1' AND plan_code = 'PLAN_4999';
    SELECT id INTO plan_7999_id FROM commission_plans WHERE service_type = 'AEPS_1' AND plan_code = 'PLAN_7999';

    IF plan_free_id IS NOT NULL THEN
        INSERT INTO bbps_commission_configs (
            service_id, service_name, commission_model, plan_id, plan_code,
            retailer_percentage, distributor_percentage, super_distributor_percentage, enabled
        ) VALUES (
            'loan-repayment', 'Loan Repayment', 'PERCENTAGE', plan_free_id, 'FREE',
            0.2000, 0.1000, 0.0500, TRUE
        ) ON CONFLICT (service_id, plan_id) DO NOTHING;
    END IF;

    IF plan_2999_id IS NOT NULL THEN
        INSERT INTO bbps_commission_configs (
            service_id, service_name, commission_model, plan_id, plan_code,
            retailer_percentage, distributor_percentage, super_distributor_percentage, enabled
        ) VALUES (
            'loan-repayment', 'Loan Repayment', 'PERCENTAGE', plan_2999_id, 'PLAN_2999',
            0.3500, 0.1500, 0.1000, TRUE
        ) ON CONFLICT (service_id, plan_id) DO NOTHING;
    END IF;

    IF plan_4999_id IS NOT NULL THEN
        INSERT INTO bbps_commission_configs (
            service_id, service_name, commission_model, plan_id, plan_code,
            retailer_percentage, distributor_percentage, super_distributor_percentage, enabled
        ) VALUES (
            'loan-repayment', 'Loan Repayment', 'PERCENTAGE', plan_4999_id, 'PLAN_4999',
            0.4500, 0.2000, 0.1500, TRUE
        ) ON CONFLICT (service_id, plan_id) DO NOTHING;
    END IF;

    IF plan_7999_id IS NOT NULL THEN
        INSERT INTO bbps_commission_configs (
            service_id, service_name, commission_model, plan_id, plan_code,
            retailer_percentage, distributor_percentage, super_distributor_percentage, enabled
        ) VALUES (
            'loan-repayment', 'Loan Repayment', 'PERCENTAGE', plan_7999_id, 'PLAN_7999',
            0.6000, 0.2500, 0.1500, TRUE
        ) ON CONFLICT (service_id, plan_id) DO NOTHING;
    END IF;
END $$;

