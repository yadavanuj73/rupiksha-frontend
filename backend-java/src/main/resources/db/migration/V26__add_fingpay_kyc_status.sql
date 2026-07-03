-- Migration V26: Add KYC status and merchant ID fields to Fingpay aepskyc table
ALTER TABLE aepskyc ADD COLUMN IF NOT EXISTS kyc_done BOOLEAN DEFAULT FALSE;
ALTER TABLE aepskyc ADD COLUMN IF NOT EXISTS merchant_id VARCHAR(100);
