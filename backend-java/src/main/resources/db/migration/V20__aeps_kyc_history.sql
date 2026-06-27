-- V20: Create transaction audit log table for AEPS KYC step tracking
CREATE TABLE IF NOT EXISTS aeps_kyc_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    provider VARCHAR(50),
    merchant_id VARCHAR(100),
    provider_reference VARCHAR(255),
    workflow_state VARCHAR(50),
    status VARCHAR(50),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    CONSTRAINT fk_aeps_kyc_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aeps_kyc_history_user ON aeps_kyc_history(user_id);
