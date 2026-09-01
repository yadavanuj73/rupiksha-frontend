-- Flyway migration: V39__create_payout_charge_slabs_table.sql
-- Creates table to configure dynamic payout charge slabs with auto GST calculation

CREATE TABLE IF NOT EXISTS payout_charge_slabs (
    id BIGSERIAL PRIMARY KEY,
    min_amount NUMERIC(12, 2) NOT NULL,
    max_amount NUMERIC(12, 2) NOT NULL,
    base_charge NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    gst_amount NUMERIC(12, 2) NOT NULL,
    total_charge NUMERIC(12, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add charge breakdown columns to payout_transactions if not existing
ALTER TABLE payout_transactions 
    ADD COLUMN IF NOT EXISTS charge_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_charged_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_deducted_amount NUMERIC(12, 2) DEFAULT 0.00;

-- Seed default payout charge slabs
-- Slab 1: Rs 500 - Rs 24,999 -> Base: Rs 5.50, 18% GST: Rs 0.99, Total: Rs 6.49
-- Slab 2: Rs 25,000 - Rs 100,000 -> Base: Rs 10.50, 18% GST: Rs 1.89, Total: Rs 12.39
INSERT INTO payout_charge_slabs (min_amount, max_amount, base_charge, gst_rate, gst_amount, total_charge, is_active, created_at, updated_at)
VALUES 
    (500.00, 24999.00, 5.50, 18.00, 0.99, 6.49, TRUE, NOW(), NOW()),
    (25000.00, 100000.00, 10.50, 18.00, 1.89, 12.39, TRUE, NOW(), NOW())
ON CONFLICT DO NOTHING;
