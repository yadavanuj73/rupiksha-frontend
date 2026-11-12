-- Migration V62: Secure Mobile OTP Login Challenges Infrastructure
CREATE TABLE IF NOT EXISTS otp_login_challenges (
    id BIGSERIAL PRIMARY KEY,
    challenge_id VARCHAR(64) NOT NULL UNIQUE,
    mobile_number VARCHAR(20) NOT NULL,
    expected_role VARCHAR(32) NOT NULL,
    user_id UUID,
    otp_hash VARCHAR(255) NOT NULL,
    provider_reference VARCHAR(255),
    expiry_at TIMESTAMP NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    resend_available_at TIMESTAMP NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    ip_address VARCHAR(64),
    user_agent VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consumed_at TIMESTAMP,
    CONSTRAINT fk_otp_login_challenge_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_login_mobile_role_status ON otp_login_challenges(mobile_number, expected_role, status);
CREATE INDEX IF NOT EXISTS idx_otp_login_challenge_id ON otp_login_challenges(challenge_id);
CREATE INDEX IF NOT EXISTS idx_otp_login_expiry_at ON otp_login_challenges(expiry_at);
CREATE INDEX IF NOT EXISTS idx_otp_login_created_at ON otp_login_challenges(created_at);
CREATE INDEX IF NOT EXISTS idx_otp_login_ip ON otp_login_challenges(ip_address, created_at);

