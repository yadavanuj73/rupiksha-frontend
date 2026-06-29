-- V22: Enterprise AEPS Transaction Engine tables and indexes

CREATE TABLE IF NOT EXISTS aeps_transaction_engine (
    id BIGSERIAL PRIMARY KEY,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    reference_number VARCHAR(100) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    merchant_id VARCHAR(80) NOT NULL,
    user_id UUID NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(30) NOT NULL,
    workflow_state VARCHAR(50) NOT NULL,
    provider_reference VARCHAR(100),
    provider_status VARCHAR(50),
    provider_message VARCHAR(255),
    initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    device_id VARCHAR(100),
    latitude VARCHAR(30),
    longitude VARCHAR(30),
    correlation_id VARCHAR(100),
    created_by VARCHAR(80),
    updated_by VARCHAR(80)
);

CREATE INDEX IF NOT EXISTS idx_aeps_engine_txn_id ON aeps_transaction_engine(transaction_id);
CREATE INDEX IF NOT EXISTS idx_aeps_engine_ref_num ON aeps_transaction_engine(reference_number);
CREATE INDEX IF NOT EXISTS idx_aeps_engine_user_id ON aeps_transaction_engine(user_id);
CREATE INDEX IF NOT EXISTS idx_aeps_engine_merchant_id ON aeps_transaction_engine(merchant_id);
CREATE INDEX IF NOT EXISTS idx_aeps_engine_workflow_state ON aeps_transaction_engine(workflow_state);
CREATE INDEX IF NOT EXISTS idx_aeps_engine_status ON aeps_transaction_engine(status);

CREATE TABLE IF NOT EXISTS aeps_transaction_history (
    id BIGSERIAL PRIMARY KEY,
    transaction_id VARCHAR(100) NOT NULL,
    workflow_state VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    remarks VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(80)
);

CREATE INDEX IF NOT EXISTS idx_aeps_hist_txn_id ON aeps_transaction_history(transaction_id);

COMMENT ON TABLE aeps_transaction_engine IS 'Stores core AEPS transaction records across all services';
COMMENT ON TABLE aeps_transaction_history IS 'Stores structural audit trail for AEPS transaction lifecycles';
