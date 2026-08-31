-- ==============================================================================
-- Migration V36: Commission Management System (AEPS 1 Phase)
-- ==============================================================================

-- 1. Commission Plans Table
CREATE TABLE IF NOT EXISTS commission_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type VARCHAR(40) NOT NULL DEFAULT 'AEPS_1',
    plan_name VARCHAR(100) NOT NULL,
    plan_code VARCHAR(50) NOT NULL,
    price NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_plan_service_code UNIQUE (service_type, plan_code)
);

-- 2. Commission Slabs Table
CREATE TABLE IF NOT EXISTS commission_slabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_plan_id UUID NOT NULL REFERENCES commission_plans(id) ON DELETE CASCADE,
    min_amount NUMERIC(18, 2) NOT NULL,
    max_amount NUMERIC(18, 2) NOT NULL,
    retailer_commission NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    distributor_commission NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    super_distributor_commission NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_slab_min_max CHECK (min_amount <= max_amount),
    CONSTRAINT chk_retailer_comm_positive CHECK (retailer_commission >= 0),
    CONSTRAINT chk_dist_comm_positive CHECK (distributor_commission >= 0),
    CONSTRAINT chk_super_dist_comm_positive CHECK (super_distributor_commission >= 0)
);

CREATE INDEX IF NOT EXISTS idx_slab_plan_id ON commission_slabs(commission_plan_id);
CREATE INDEX IF NOT EXISTS idx_slab_plan_range ON commission_slabs(commission_plan_id, min_amount, max_amount);

-- 3. Commission Transactions (Audit & Ledger)
CREATE TABLE IF NOT EXISTS commission_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_reference VARCHAR(64) NOT NULL UNIQUE,
    original_transaction_id VARCHAR(120) NOT NULL,
    service_type VARCHAR(40) NOT NULL DEFAULT 'AEPS_1',
    plan_id UUID REFERENCES commission_plans(id),
    plan_code VARCHAR(50),
    slab_id UUID REFERENCES commission_slabs(id),
    slab_min NUMERIC(18, 2) NOT NULL,
    slab_max NUMERIC(18, 2) NOT NULL,
    transaction_amount NUMERIC(18, 2) NOT NULL,
    beneficiary_user_id UUID NOT NULL REFERENCES users(id),
    beneficiary_role VARCHAR(40) NOT NULL,
    retailer_user_id UUID NOT NULL REFERENCES users(id),
    commission_amount NUMERIC(18, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    wallet_entry_id UUID REFERENCES wallet_entries(id),
    remarks VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Database-level uniqueness safeguard for idempotency
    CONSTRAINT uq_comm_orig_beneficiary UNIQUE (original_transaction_id, beneficiary_user_id, beneficiary_role)
);

CREATE INDEX IF NOT EXISTS idx_comm_txn_orig ON commission_transactions(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_comm_txn_beneficiary ON commission_transactions(beneficiary_user_id);
CREATE INDEX IF NOT EXISTS idx_comm_txn_retailer ON commission_transactions(retailer_user_id);
CREATE INDEX IF NOT EXISTS idx_comm_txn_created ON commission_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_comm_txn_service_status ON commission_transactions(service_type, status);

-- 4. Add commission plan reference to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS aeps_commission_plan_id UUID REFERENCES commission_plans(id);

-- 5. Seed Initial Plans and Slabs for AEPS 1
DO $$
DECLARE
    plan_free_id UUID := gen_random_uuid();
    plan_2999_id UUID := gen_random_uuid();
    plan_4999_id UUID := gen_random_uuid();
    plan_7999_id UUID := gen_random_uuid();
BEGIN
    -- Plan 1: Free
    INSERT INTO commission_plans (id, service_type, plan_name, plan_code, price, is_default, enabled)
    VALUES (plan_free_id, 'AEPS_1', 'Free', 'FREE', 0.00, TRUE, TRUE)
    ON CONFLICT (service_type, plan_code) DO NOTHING;

    -- Plan 2: ₹2999
    INSERT INTO commission_plans (id, service_type, plan_name, plan_code, price, is_default, enabled)
    VALUES (plan_2999_id, 'AEPS_1', '₹2999', 'PLAN_2999', 2999.00, FALSE, TRUE)
    ON CONFLICT (service_type, plan_code) DO NOTHING;

    -- Plan 3: ₹4999
    INSERT INTO commission_plans (id, service_type, plan_name, plan_code, price, is_default, enabled)
    VALUES (plan_4999_id, 'AEPS_1', '₹4999', 'PLAN_4999', 4999.00, FALSE, TRUE)
    ON CONFLICT (service_type, plan_code) DO NOTHING;

    -- Plan 4: ₹7999
    INSERT INTO commission_plans (id, service_type, plan_name, plan_code, price, is_default, enabled)
    VALUES (plan_7999_id, 'AEPS_1', '₹7999', 'PLAN_7999', 7999.00, FALSE, TRUE)
    ON CONFLICT (service_type, plan_code) DO NOTHING;

    -- Retrieve actual IDs if existed
    SELECT id INTO plan_free_id FROM commission_plans WHERE service_type = 'AEPS_1' AND plan_code = 'FREE';
    SELECT id INTO plan_2999_id FROM commission_plans WHERE service_type = 'AEPS_1' AND plan_code = 'PLAN_2999';
    SELECT id INTO plan_4999_id FROM commission_plans WHERE service_type = 'AEPS_1' AND plan_code = 'PLAN_4999';
    SELECT id INTO plan_7999_id FROM commission_plans WHERE service_type = 'AEPS_1' AND plan_code = 'PLAN_7999';

    -- Slabs for FREE Plan
    INSERT INTO commission_slabs (commission_plan_id, min_amount, max_amount, retailer_commission, distributor_commission, super_distributor_commission)
    VALUES
    (plan_free_id, 500.00, 999.00, 1.00, 0.00, 0.00),
    (plan_free_id, 1000.00, 1499.00, 2.00, 0.50, 0.50),
    (plan_free_id, 1500.00, 1999.00, 3.00, 1.00, 1.00),
    (plan_free_id, 2000.00, 2499.00, 4.00, 1.00, 1.00),
    (plan_free_id, 2500.00, 2999.00, 5.00, 1.00, 1.00),
    (plan_free_id, 3000.00, 7999.00, 7.00, 2.00, 2.00),
    (plan_free_id, 8000.00, 10000.00, 9.00, 2.00, 2.00)
    ON CONFLICT DO NOTHING;

    -- Slabs for ₹2999 Plan
    INSERT INTO commission_slabs (commission_plan_id, min_amount, max_amount, retailer_commission, distributor_commission, super_distributor_commission)
    VALUES
    (plan_2999_id, 500.00, 999.00, 1.00, 0.00, 0.00),
    (plan_2999_id, 1000.00, 1499.00, 2.00, 0.50, 0.50),
    (plan_2999_id, 1500.00, 1999.00, 3.00, 1.00, 1.00),
    (plan_2999_id, 2000.00, 2499.00, 4.00, 1.00, 1.00),
    (plan_2999_id, 2500.00, 2999.00, 5.00, 1.00, 1.00),
    (plan_2999_id, 3000.00, 7999.00, 9.00, 1.00, 1.00),
    (plan_2999_id, 8000.00, 10000.00, 11.00, 0.50, 0.50)
    ON CONFLICT DO NOTHING;

    -- Slabs for ₹4999 Plan
    INSERT INTO commission_slabs (commission_plan_id, min_amount, max_amount, retailer_commission, distributor_commission, super_distributor_commission)
    VALUES
    (plan_4999_id, 500.00, 999.00, 1.00, 0.00, 0.00),
    (plan_4999_id, 1000.00, 1499.00, 3.00, 0.25, 0.25),
    (plan_4999_id, 1500.00, 1999.00, 4.00, 0.50, 0.50),
    (plan_4999_id, 2000.00, 2499.00, 6.00, 0.50, 0.50),
    (plan_4999_id, 2500.00, 2999.00, 7.00, 0.50, 0.50),
    (plan_4999_id, 3000.00, 7999.00, 10.00, 1.00, 1.00),
    (plan_4999_id, 8000.00, 10000.00, 13.00, 0.25, 0.25)
    ON CONFLICT DO NOTHING;

    -- Slabs for ₹7999 Plan
    INSERT INTO commission_slabs (commission_plan_id, min_amount, max_amount, retailer_commission, distributor_commission, super_distributor_commission)
    VALUES
    (plan_7999_id, 500.00, 999.00, 1.00, 0.00, 0.00),
    (plan_7999_id, 1000.00, 1499.00, 3.00, 0.25, 0.25),
    (plan_7999_id, 1500.00, 1999.00, 5.00, 0.25, 0.25),
    (plan_7999_id, 2000.00, 2499.00, 7.00, 0.25, 0.25),
    (plan_7999_id, 2500.00, 2999.00, 9.00, 0.25, 0.25),
    (plan_7999_id, 3000.00, 7999.00, 12.00, 0.25, 0.25),
    (plan_7999_id, 8000.00, 10000.00, 16.00, 0.00, 0.00)
    ON CONFLICT DO NOTHING;
END $$;
