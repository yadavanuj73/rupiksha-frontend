-- Flyway migration: V68__update_payout_min_amount_to_100.sql
-- Adjust lowest payout charge slab min_amount from Rs 500 to Rs 100

UPDATE payout_charge_slabs
SET min_amount = 100.00, updated_at = NOW()
WHERE min_amount = 500.00;
