-- Create payout_beneficiaries table
CREATE TABLE IF NOT EXISTS payout_beneficiaries (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    beneficiary_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    ifsc VARCHAR(11) NOT NULL,
    bank_name VARCHAR(100),
    nick_name VARCHAR(50),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payout_bene_user_id ON payout_beneficiaries(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_bene_user_created ON payout_beneficiaries(user_id, created_at);

-- Comments
COMMENT ON TABLE payout_beneficiaries IS 'Stores saved payout beneficiaries for users';
COMMENT ON COLUMN payout_beneficiaries.user_id IS 'User ID who owns this beneficiary record';
COMMENT ON COLUMN payout_beneficiaries.is_verified IS 'Whether account was bank-verified';
