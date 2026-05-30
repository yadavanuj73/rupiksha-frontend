-- Add AEPS onboarding fields to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS aeps_agent_id    VARCHAR(80),
    ADD COLUMN IF NOT EXISTS aeps_merchant_id VARCHAR(80),
    ADD COLUMN IF NOT EXISTS aeps_onboarded   BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_aeps_agent_id ON users(aeps_agent_id);
