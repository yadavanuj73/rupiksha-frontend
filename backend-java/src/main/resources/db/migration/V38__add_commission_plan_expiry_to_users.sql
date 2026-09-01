-- ==============================================================================
-- Migration V38: Add Commission Plan Expiry and Activation Timestamps to Users
-- ==============================================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS aeps_commission_plan_activated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS aeps_commission_plan_expires_at TIMESTAMP;

-- Backfill for existing users who already have an active paid plan assigned
UPDATE users 
SET aeps_commission_plan_activated_at = COALESCE(updated_at, NOW()),
    aeps_commission_plan_expires_at = COALESCE(updated_at, NOW()) + INTERVAL '1 year'
WHERE aeps_commission_plan_id IS NOT NULL 
  AND aeps_commission_plan_id IN (SELECT id FROM commission_plans WHERE price > 0)
  AND aeps_commission_plan_expires_at IS NULL;
