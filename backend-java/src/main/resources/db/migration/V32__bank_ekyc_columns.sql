-- V32: Add Bank eKYC (BeKYC) columns to aepskyc table
-- Required for mandatory Bank eKYC verification per updated Fingpay API (FY 2025-26)

ALTER TABLE aepskyc
    ADD COLUMN IF NOT EXISTS bank_ekyc_done           BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS bank_ekyc_primary_key_id BIGINT      DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bank_ekyc_encode_fp_txn_id VARCHAR(500) DEFAULT NULL;

-- Backfill: existing users who completed regular KYC are considered bank_ekyc_done = false
-- (they will be prompted to complete Bank eKYC on next login to the AEPS KYC page)
UPDATE aepskyc SET bank_ekyc_done = FALSE WHERE bank_ekyc_done IS NULL;

-- Index for quick lookup during status checks
CREATE INDEX IF NOT EXISTS idx_aepskyc_bank_ekyc_done ON aepskyc (bank_ekyc_done);
