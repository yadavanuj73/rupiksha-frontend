-- V15: Add aeps_kyc_done field to track Levin AEPS KYC completion
ALTER TABLE users ADD COLUMN IF NOT EXISTS aeps_kyc_done BOOLEAN NOT NULL DEFAULT FALSE;
