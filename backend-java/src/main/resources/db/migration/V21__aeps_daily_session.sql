-- V21: Add session tracking columns for daily 2FA authentication
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_2fa_session_id VARCHAR(255);
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_2fa_authenticated_at TIMESTAMP;

ALTER TABLE users ADD COLUMN IF NOT EXISTS aeps_2fa_session_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS aeps_2fa_authenticated_at TIMESTAMP;
