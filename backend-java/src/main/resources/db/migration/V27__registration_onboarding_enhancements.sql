-- V27: Registration, Onboarding (KYC), PIN, Hierarchy & Admin Visibility Enhancements

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash               VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS father_name            VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender                 VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_type          VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gst_number             VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_landmark          VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_state             VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_district          VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_city              VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_pincode           VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS perm_state             VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS perm_district          VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS perm_city              VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS perm_pincode           VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_holder    VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name              VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_number    VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_ifsc              VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_branch            VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_back_photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS driving_licence_url    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS voter_id_url           TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_url           TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS live_selfie_url        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_lat                VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_long               VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_timestamp          TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_info            VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_last_changed   TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_last_changed        TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_verified           BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_status    VARCHAR(40) DEFAULT 'APPROVED';
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_user_id         UUID REFERENCES users(id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_party_code ON users(party_code);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_reg_status ON users(registration_status);
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_user_id);
