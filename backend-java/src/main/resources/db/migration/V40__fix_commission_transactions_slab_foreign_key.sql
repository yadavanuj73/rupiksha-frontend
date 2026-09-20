-- ==============================================================================
-- Migration V40: Fix Foreign Key Constraints on Commission Transactions
-- ==============================================================================
-- Allow referenced slabs or plans to be updated/deleted without violating FK
-- constraints by setting ON DELETE SET NULL on commission_transactions.

ALTER TABLE commission_transactions 
    DROP CONSTRAINT IF EXISTS commission_transactions_slab_id_fkey;

ALTER TABLE commission_transactions 
    ADD CONSTRAINT commission_transactions_slab_id_fkey 
    FOREIGN KEY (slab_id) REFERENCES commission_slabs(id) ON DELETE SET NULL;

ALTER TABLE commission_transactions 
    DROP CONSTRAINT IF EXISTS commission_transactions_plan_id_fkey;

ALTER TABLE commission_transactions 
    ADD CONSTRAINT commission_transactions_plan_id_fkey 
    FOREIGN KEY (plan_id) REFERENCES commission_plans(id) ON DELETE SET NULL;
