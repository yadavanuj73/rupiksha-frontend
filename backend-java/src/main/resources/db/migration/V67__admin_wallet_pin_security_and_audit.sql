-- Migration V67: Secure 6-Digit Admin Wallet Transaction PIN System & Audit Trail

-- 1. Table for persistent Admin PIN security state, failed attempts and escalating lockouts
CREATE TABLE IF NOT EXISTS admin_wallet_pin_security_state (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    admin_username VARCHAR(100) NOT NULL,
    consecutive_failed_attempts INT NOT NULL DEFAULT 0,
    total_failed_attempts INT NOT NULL DEFAULT 0,
    last_failed_at TIMESTAMP,
    locked_until TIMESTAMP,
    lockout_count INT NOT NULL DEFAULT 0,
    last_successful_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_pin_sec_user ON admin_wallet_pin_security_state(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_pin_sec_locked ON admin_wallet_pin_security_state(locked_until);

COMMENT ON TABLE admin_wallet_pin_security_state IS 'Persistent server-side failed-attempt counters and escalating lockouts for Admin Wallet PIN';

-- 2. Table for IP-level rate limiting and lockout tracking
CREATE TABLE IF NOT EXISTS admin_wallet_pin_ip_state (
    ip_address VARCHAR(64) PRIMARY KEY,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    last_attempt_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_pin_ip_locked ON admin_wallet_pin_ip_state(locked_until);

COMMENT ON TABLE admin_wallet_pin_ip_state IS 'Request/network-level brute-force protection and lockout state for Admin Wallet PIN';

-- 3. Table for immutable, tamper-resistant Admin Wallet PIN audit trail
CREATE TABLE IF NOT EXISTS admin_wallet_pin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL UNIQUE,
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_username VARCHAR(100),
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_username VARCHAR(100),
    operation_type VARCHAR(64) NOT NULL,
    amount NUMERIC(18, 2),
    fund_request_id VARCHAR(64),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    outcome VARCHAR(64) NOT NULL,
    transaction_reference_id VARCHAR(64),
    failure_category VARCHAR(64),
    failure_reason VARCHAR(255),
    correlation_id VARCHAR(64),
    source_ip VARCHAR(64),
    user_agent VARCHAR(500),
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_wallet_pin_audit_admin ON admin_wallet_pin_audit_log(admin_user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_wallet_pin_audit_target ON admin_wallet_pin_audit_log(target_user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_wallet_pin_audit_op ON admin_wallet_pin_audit_log(operation_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_wallet_pin_audit_outcome ON admin_wallet_pin_audit_log(outcome);
CREATE INDEX IF NOT EXISTS idx_wallet_pin_audit_timestamp ON admin_wallet_pin_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_wallet_pin_audit_ip ON admin_wallet_pin_audit_log(source_ip, timestamp);

COMMENT ON TABLE admin_wallet_pin_audit_log IS 'Tamper-resistant audit log capturing all Admin Wallet protected actions, PIN verifications, lockouts and failures (never stores plaintext PIN)';
