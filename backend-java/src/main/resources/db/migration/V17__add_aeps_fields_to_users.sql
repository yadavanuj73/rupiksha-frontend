-- Add AEPS related fields to users table
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_agent_id VARCHAR(255);
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_merchant_id VARCHAR(255);
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_onboarded BOOLEAN DEFAULT FALSE;
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_kyc_done BOOLEAN DEFAULT FALSE;

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_aeps_users_username ON aeps_users(username);

-- Made with Bob
