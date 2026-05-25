-- V13: Extended onboarding KYC fields for full identity & document storage
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name       VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name        VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob              VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_address     VARCHAR(300);
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_address VARCHAR(300);
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_photo_url   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_passbook_url TEXT;
