-- ==============================================================================
-- Migration V55: Mobile & DTH Recharge Commission Management System
-- ==============================================================================

-- 1. Extend commission_transactions table for Mobile & DTH Recharge
ALTER TABLE commission_transactions
    ADD COLUMN IF NOT EXISTS commission_mode VARCHAR(20) DEFAULT 'PERCENTAGE',
    ADD COLUMN IF NOT EXISTS operator_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS operator_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS applied_commission_value NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS mobile_no VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_comm_txn_operator_code ON commission_transactions(operator_code);
CREATE INDEX IF NOT EXISTS idx_comm_txn_mode ON commission_transactions(commission_mode);
CREATE INDEX IF NOT EXISTS idx_comm_txn_svc_op ON commission_transactions(service_type, operator_code);

-- 2. Create Recharge Commission Configurations Table
CREATE TABLE IF NOT EXISTS recharge_commission_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type VARCHAR(40) NOT NULL DEFAULT 'MOBILE_RECHARGE',
    operator_code VARCHAR(20) NOT NULL,
    operator_name VARCHAR(100) NOT NULL,
    commission_mode VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE',
    plan_id UUID NOT NULL REFERENCES commission_plans(id) ON DELETE CASCADE,
    plan_code VARCHAR(50) NOT NULL,
    retailer_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    distributor_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    super_distributor_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_recharge_comm_svc_op_plan UNIQUE (service_type, operator_code, plan_id),
    CONSTRAINT chk_recharge_comm_mode CHECK (commission_mode IN ('PERCENTAGE', 'FIXED')),
    CONSTRAINT chk_recharge_ret_val CHECK (retailer_value >= 0),
    CONSTRAINT chk_recharge_dist_val CHECK (distributor_value >= 0),
    CONSTRAINT chk_recharge_sd_val CHECK (super_distributor_value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_recharge_comm_svc_op ON recharge_commission_configs(service_type, operator_code);
CREATE INDEX IF NOT EXISTS idx_recharge_comm_plan ON recharge_commission_configs(plan_id);
CREATE INDEX IF NOT EXISTS idx_recharge_comm_enabled ON recharge_commission_configs(enabled);

-- 3. Create Recharge Commission Configuration Audit Table
CREATE TABLE IF NOT EXISTS recharge_commission_config_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES recharge_commission_configs(id) ON DELETE SET NULL,
    service_type VARCHAR(40) NOT NULL,
    operator_code VARCHAR(20) NOT NULL,
    plan_code VARCHAR(50) NOT NULL,
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_username VARCHAR(100),
    prev_commission_mode VARCHAR(20),
    prev_retailer_value NUMERIC(18, 4),
    prev_distributor_value NUMERIC(18, 4),
    prev_super_distributor_value NUMERIC(18, 4),
    prev_enabled BOOLEAN,
    new_commission_mode VARCHAR(20),
    new_retailer_value NUMERIC(18, 4),
    new_distributor_value NUMERIC(18, 4),
    new_super_distributor_value NUMERIC(18, 4),
    new_enabled BOOLEAN,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recharge_audit_svc_op ON recharge_commission_config_audits(service_type, operator_code);
CREATE INDEX IF NOT EXISTS idx_recharge_audit_created ON recharge_commission_config_audits(created_at DESC);

-- 4. Seed initial configurations for supported Mobile Recharge operators
-- Linked to the 4 existing membership plans (FREE, PLAN_2999, PLAN_4999, PLAN_7999)
DO $$
DECLARE
    plan_rec RECORD;
    op_code VARCHAR(20);
    op_name VARCHAR(100);
BEGIN
    FOR op_code, op_name IN VALUES
        ('JRE', 'Jio Recharge'),
        ('JTU', 'Jio Topup'),
        ('ATL', 'Airtel'),
        ('ACL', 'Airtel Live'),
        ('VDF', 'Vi (Vodafone Idea)'),
        ('BNT', 'BSNL Topup'),
        ('BNV', 'BSNL Validity'),
        ('VCT', 'Videocon Topup'),
        ('VCV', 'Videocon Validity')
    LOOP
        FOR plan_rec IN SELECT id, plan_code FROM commission_plans WHERE service_type = 'AEPS_1' LOOP
            INSERT INTO recharge_commission_configs (
                service_type, operator_code, operator_name, commission_mode,
                plan_id, plan_code, retailer_value, distributor_value, super_distributor_value, enabled
            ) VALUES (
                'MOBILE_RECHARGE', op_code, op_name, 'PERCENTAGE',
                plan_rec.id, plan_rec.plan_code,
                CASE
                    WHEN plan_rec.plan_code = 'FREE' THEN 1.0000
                    WHEN plan_rec.plan_code = 'PLAN_2999' THEN 1.5000
                    WHEN plan_rec.plan_code = 'PLAN_4999' THEN 2.0000
                    WHEN plan_rec.plan_code = 'PLAN_7999' THEN 2.5000
                    ELSE 1.0000
                END,
                0.2500,
                0.2500,
                TRUE
            ) ON CONFLICT (service_type, operator_code, plan_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

