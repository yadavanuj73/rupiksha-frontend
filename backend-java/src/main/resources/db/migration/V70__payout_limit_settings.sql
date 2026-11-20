-- Flyway migration: V70__payout_limit_settings.sql
-- Persistent Payout Limit Settings (Minimum & Maximum Payout Amount per Transaction) and Audit Trail

-- 1. Table for persistent global payout limit configuration (single active configuration row)
CREATE TABLE IF NOT EXISTS payout_limit_settings (
    id BIGINT PRIMARY KEY,
    minimum_payout_amount NUMERIC(12, 2) NOT NULL,
    maximum_payout_amount NUMERIC(12, 2) NOT NULL,
    updated_by VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_payout_limit_single_row CHECK (id = 1),
    CONSTRAINT chk_payout_limit_positive_min CHECK (minimum_payout_amount > 0),
    CONSTRAINT chk_payout_limit_positive_max CHECK (maximum_payout_amount > 0),
    CONSTRAINT chk_payout_limit_min_lte_max CHECK (minimum_payout_amount <= maximum_payout_amount)
);

COMMENT ON TABLE payout_limit_settings IS 'Authoritative global minimum and maximum payout amount configuration per individual transaction';

-- Seed default configuration: Min Rs 100.00, Max Rs 100,000.00 (derived from existing live fee slabs)
INSERT INTO payout_limit_settings (id, minimum_payout_amount, maximum_payout_amount, updated_by, version, created_at, updated_at)
VALUES (1, 100.00, 100000.00, 'SYSTEM', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 2. Table for immutable audit trail of all payout limit configuration changes
CREATE TABLE IF NOT EXISTS payout_limit_settings_audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL UNIQUE,
    admin_user_id VARCHAR(64),
    admin_username VARCHAR(100),
    previous_minimum_amount NUMERIC(12, 2),
    new_minimum_amount NUMERIC(12, 2),
    previous_maximum_amount NUMERIC(12, 2),
    new_maximum_amount NUMERIC(12, 2),
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    correlation_id VARCHAR(64),
    source_ip VARCHAR(64),
    user_agent VARCHAR(500),
    operation_result VARCHAR(32) NOT NULL,
    failure_reason VARCHAR(255),
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_payout_limit_audit_timestamp ON payout_limit_settings_audit_log(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_payout_limit_audit_admin ON payout_limit_settings_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_limit_audit_event_id ON payout_limit_settings_audit_log(event_id);

COMMENT ON TABLE payout_limit_settings_audit_log IS 'Tamper-resistant audit log capturing all Admin updates to payout limits with before/after state and correlation IDs';
