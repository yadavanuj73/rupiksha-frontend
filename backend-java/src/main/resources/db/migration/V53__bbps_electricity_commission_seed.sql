-- ==============================================================================
-- Migration V53: Seed BBPS Electricity Percentage Commission Configurations
-- ==============================================================================

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

    -- Plan 1: FREE (Retailer 0.20%, Distributor 0.10%, Super Distributor 0.05%)
    IF plan_free_id IS NOT NULL THEN
        INSERT INTO bbps_commission_configs (
            service_id, service_name, commission_model, plan_id, plan_code,
            retailer_percentage, distributor_percentage, super_distributor_percentage, enabled
        ) VALUES (
            'electricity', 'Electricity', 'PERCENTAGE', plan_free_id, 'FREE',
            0.2000, 0.1000, 0.0500, TRUE
        ) ON CONFLICT (service_id, plan_id) DO NOTHING;
    END IF;

    -- Plan 2: ₹2,999 (Retailer 0.35%, Distributor 0.15%, Super Distributor 0.10%)
    IF plan_2999_id IS NOT NULL THEN
        INSERT INTO bbps_commission_configs (
            service_id, service_name, commission_model, plan_id, plan_code,
            retailer_percentage, distributor_percentage, super_distributor_percentage, enabled
        ) VALUES (
            'electricity', 'Electricity', 'PERCENTAGE', plan_2999_id, 'PLAN_2999',
            0.3500, 0.1500, 0.1000, TRUE
        ) ON CONFLICT (service_id, plan_id) DO NOTHING;
    END IF;

    -- Plan 3: ₹4,999 (Retailer 0.45%, Distributor 0.20%, Super Distributor 0.15%)
    IF plan_4999_id IS NOT NULL THEN
        INSERT INTO bbps_commission_configs (
            service_id, service_name, commission_model, plan_id, plan_code,
            retailer_percentage, distributor_percentage, super_distributor_percentage, enabled
        ) VALUES (
            'electricity', 'Electricity', 'PERCENTAGE', plan_4999_id, 'PLAN_4999',
            0.4500, 0.2000, 0.1500, TRUE
        ) ON CONFLICT (service_id, plan_id) DO NOTHING;
    END IF;

    -- Plan 4: ₹7,999 (Retailer 0.60%, Distributor 0.25%, Super Distributor 0.15%)
    IF plan_7999_id IS NOT NULL THEN
        INSERT INTO bbps_commission_configs (
            service_id, service_name, commission_model, plan_id, plan_code,
            retailer_percentage, distributor_percentage, super_distributor_percentage, enabled
        ) VALUES (
            'electricity', 'Electricity', 'PERCENTAGE', plan_7999_id, 'PLAN_7999',
            0.6000, 0.2500, 0.1500, TRUE
        ) ON CONFLICT (service_id, plan_id) DO NOTHING;
    END IF;
END $$;
