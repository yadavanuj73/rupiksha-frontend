-- Migration V65: Admin Mandatory 2FA OTP Authentication, Session Invalidation & Audit Trail

-- 1. Add admin_session_version to users table for server-side token invalidation
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_session_version INT NOT NULL DEFAULT 1;

-- 2. Invalidate all existing admin sessions and refresh tokens
-- Increment admin_session_version to 2 for all ADMIN accounts so pre-deployment JWTs are rejected
UPDATE users 
SET admin_session_version = 2 
WHERE id IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE r.name = 'ADMIN'
);

-- Revoke all existing admin refresh tokens in database
UPDATE refresh_tokens 
SET revoked = TRUE 
WHERE user_id IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE r.name = 'ADMIN'
);

-- 3. Create admin_otp_challenges table
CREATE TABLE IF NOT EXISTS admin_otp_challenges (
    id BIGSERIAL PRIMARY KEY,
    challenge_id VARCHAR(64) NOT NULL UNIQUE,
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_username VARCHAR(100) NOT NULL,
    destination_identifier VARCHAR(32) NOT NULL,
    masked_destination VARCHAR(20) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    provider_reference VARCHAR(255),
    expiry_at TIMESTAMP NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    resend_count INT NOT NULL DEFAULT 0,
    resend_available_at TIMESTAMP NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    ip_address VARCHAR(64),
    user_agent VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    consumed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_otp_challenge_id ON admin_otp_challenges(challenge_id);
CREATE INDEX IF NOT EXISTS idx_admin_otp_user_status ON admin_otp_challenges(admin_user_id, status);
CREATE INDEX IF NOT EXISTS idx_admin_otp_created_at ON admin_otp_challenges(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_otp_expiry_at ON admin_otp_challenges(expiry_at);
CREATE INDEX IF NOT EXISTS idx_admin_otp_ip ON admin_otp_challenges(ip_address, created_at);

COMMENT ON TABLE admin_otp_challenges IS 'Secure multi-factor OTP authentication challenges for admin logins';

-- 4. Create admin_auth_audit_log table
CREATE TABLE IF NOT EXISTS admin_auth_audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL UNIQUE,
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_username VARCHAR(100),
    admin_role VARCHAR(50),
    event_type VARCHAR(64) NOT NULL,
    event_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    masked_destination VARCHAR(20),
    challenge_id VARCHAR(64),
    source_ip VARCHAR(64),
    user_agent VARCHAR(500),
    device_info VARCHAR(255),
    correlation_id VARCHAR(64),
    outcome VARCHAR(32) NOT NULL,
    failure_reason VARCHAR(255),
    session_id VARCHAR(100),
    auth_version INT,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_event_type ON admin_auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_user ON admin_auth_audit_log(admin_user_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_admin_audit_timestamp ON admin_auth_audit_log(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_admin_audit_ip ON admin_auth_audit_log(source_ip, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_admin_audit_challenge ON admin_auth_audit_log(challenge_id);

COMMENT ON TABLE admin_auth_audit_log IS 'Immutable tamper-resistant audit trail for all admin authentication events';
