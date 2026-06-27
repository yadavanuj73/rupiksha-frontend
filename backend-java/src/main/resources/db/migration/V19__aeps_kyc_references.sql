-- V19: Add columns for tracking AEPS KYC reference details and completion timestamps
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_kyc_refid VARCHAR(255);
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_kyc_txnid VARCHAR(255);
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_kyc_completed_at TIMESTAMP;

ALTER TABLE users ADD COLUMN IF NOT EXISTS aeps_kyc_refid VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS aeps_kyc_txnid VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS aeps_kyc_completed_at TIMESTAMP;
