-- ==============================================================================
-- Migration V54: Fix BBPS Commission Configs Enabled Status, Set Defaults & Reconcile
-- ==============================================================================

-- 1. Ensure all existing bbps_commission_configs for 'electricity' and 'loan-repayment' have enabled = TRUE
UPDATE bbps_commission_configs
SET enabled = TRUE
WHERE service_id IN ('electricity', 'loan-repayment');

-- 2. If retailer_percentage is 0 on FREE plan, provide active defaults so standard retailers earn commission
UPDATE bbps_commission_configs
SET retailer_percentage = 0.5000,
    distributor_percentage = 0.2500,
    super_distributor_percentage = 0.1500,
    enabled = TRUE
WHERE service_id IN ('electricity', 'loan-repayment')
  AND plan_code = 'FREE'
  AND (retailer_percentage IS NULL OR retailer_percentage <= 0.0000);

-- 3. If retailer_percentage is 0 on PLAN_2999, provide active default (0.75% or preserve existing if > 0)
UPDATE bbps_commission_configs
SET retailer_percentage = 0.7500,
    distributor_percentage = 0.3000,
    super_distributor_percentage = 0.2000,
    enabled = TRUE
WHERE service_id IN ('electricity', 'loan-repayment')
  AND plan_code = 'PLAN_2999'
  AND (retailer_percentage IS NULL OR retailer_percentage <= 0.0000);

-- 4. If retailer_percentage is 0 on PLAN_4999
UPDATE bbps_commission_configs
SET retailer_percentage = 1.0000,
    distributor_percentage = 0.3500,
    super_distributor_percentage = 0.2500,
    enabled = TRUE
WHERE service_id IN ('electricity', 'loan-repayment')
  AND plan_code = 'PLAN_4999'
  AND (retailer_percentage IS NULL OR retailer_percentage <= 0.0000);

-- 5. If retailer_percentage is 0 on PLAN_7999
UPDATE bbps_commission_configs
SET retailer_percentage = 1.5000,
    distributor_percentage = 0.4000,
    super_distributor_percentage = 0.2500,
    enabled = TRUE
WHERE service_id IN ('electricity', 'loan-repayment')
  AND plan_code = 'PLAN_7999'
  AND (retailer_percentage IS NULL OR retailer_percentage <= 0.0000);

-- 6. Insert missing records for any plans not yet present
DO $$
DECLARE
    plan_rec RECORD;
    svc_id VARCHAR(64);
    svc_name VARCHAR(100);
BEGIN
    FOR svc_id, svc_name IN VALUES ('electricity', 'Electricity'), ('loan-repayment', 'Loan Repayment') LOOP
        FOR plan_rec IN SELECT id, plan_code FROM commission_plans WHERE service_type = 'AEPS_1' LOOP
            INSERT INTO bbps_commission_configs (
                service_id, service_name, commission_model, plan_id, plan_code,
                retailer_percentage, distributor_percentage, super_distributor_percentage, enabled
            ) VALUES (
                svc_id, svc_name, 'PERCENTAGE', plan_rec.id, plan_rec.plan_code,
                CASE 
                    WHEN plan_rec.plan_code = 'FREE' THEN 0.5000
                    WHEN plan_rec.plan_code = 'PLAN_2999' THEN 0.7500
                    WHEN plan_rec.plan_code = 'PLAN_4999' THEN 1.0000
                    WHEN plan_rec.plan_code = 'PLAN_7999' THEN 1.5000
                    ELSE 0.5000
                END,
                0.2500, 0.1500, TRUE
            ) ON CONFLICT (service_id, plan_id) DO UPDATE SET enabled = TRUE;
        END LOOP;
    END LOOP;
END $$;
