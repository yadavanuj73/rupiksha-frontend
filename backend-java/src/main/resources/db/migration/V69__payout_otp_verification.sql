-- Migration V69: Mandatory Payout OTP Verification & Audit Trail Infrastructure

CREATE TABLE IF NOT EXISTS payout_otp_challenges (
    id BIGSERIAL PRIMARY KEY,
    challenge_id VARCHAR(64) NOT NULL UNIQUE,
    payout_intent_id VARCHAR(64) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_role VARCHAR(32) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    masked_mobile VARCHAR(20) NOT NULL,
    beneficiary_id BIGINT,
    beneficiary_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(30) NOT NULL,
    ifsc VARCHAR(20) NOT NULL,
    bank_name VARCHAR(100),
    transfer_mode VARCHAR(10) NOT NULL DEFAULT 'IMPS',
    amount NUMERIC(12, 2) NOT NULL,
    base_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_deducted_amount NUMERIC(12, 2) NOT NULL,
    payload_hash VARCHAR(128) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    provider_reference VARCHAR(255),
    expiry_at TIMESTAMP NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    resend_count INT NOT NULL DEFAULT 0,
    resend_available_at TIMESTAMP NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    authorization_reference VARCHAR(128) UNIQUE,
    authorization_expires_at TIMESTAMP,
    ip_address VARCHAR(64),
    user_agent VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    consumed_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payout_otp_challenge_id ON payout_otp_challenges(challenge_id);
CREATE INDEX IF NOT EXISTS idx_payout_otp_intent_id ON payout_otp_challenges(payout_intent_id);
CREATE INDEX IF NOT EXISTS idx_payout_otp_user_status ON payout_otp_challenges(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payout_otp_auth_ref ON payout_otp_challenges(authorization_reference);
CREATE INDEX IF NOT EXISTS idx_payout_otp_expiry_at ON payout_otp_challenges(expiry_at);
CREATE INDEX IF NOT EXISTS idx_payout_otp_created_at ON payout_otp_challenges(created_at);
CREATE INDEX IF NOT EXISTS idx_payout_otp_ip_created ON payout_otp_challenges(ip_address, created_at);

COMMENT ON TABLE payout_otp_challenges IS 'Mandatory OTP authorization challenges for instant payout transactions';

CREATE TABLE IF NOT EXISTS payout_otp_audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_role VARCHAR(50),
    event_type VARCHAR(64) NOT NULL,
    event_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    challenge_id VARCHAR(64),
    payout_intent_id VARCHAR(64),
    authorization_reference VARCHAR(128),
    masked_mobile VARCHAR(20),
    source_ip VARCHAR(64),
    user_agent VARCHAR(500),
    correlation_id VARCHAR(64),
    outcome VARCHAR(32) NOT NULL,
    failure_reason VARCHAR(255),
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_payout_otp_audit_event_type ON payout_otp_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_payout_otp_audit_user_time ON payout_otp_audit_log(user_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_payout_otp_audit_timestamp ON payout_otp_audit_log(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_payout_otp_audit_challenge ON payout_otp_audit_log(challenge_id);
CREATE INDEX IF NOT EXISTS idx_payout_otp_audit_auth_ref ON payout_otp_audit_log(authorization_reference);

COMMENT ON TABLE payout_otp_audit_log IS 'Immutable tamper-resistant audit trail for all payout OTP authorization lifecycle events';
