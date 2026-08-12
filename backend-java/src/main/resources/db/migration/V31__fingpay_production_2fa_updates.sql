-- Migration V31: Add Fingpay 2FA Transaction Log and separate Aadhaar Pay 2FA session columns

CREATE TABLE IF NOT EXISTS fingpay_2fa_txn (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    merchant_tran_id VARCHAR(100) UNIQUE,
    fingpay_transaction_id VARCHAR(100),
    tef_pk_id BIGINT,
    stan VARCHAR(50),
    fp_rrn VARCHAR(100),
    response_code VARCHAR(50),
    response_message VARCHAR(255),
    mobile_number VARCHAR(20),
    transaction_timestamp TIMESTAMP,
    authenticated_at TIMESTAMP,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    service_type VARCHAR(50) DEFAULT 'AEPS',
    provider VARCHAR(50) DEFAULT 'fingpay',
    CONSTRAINT fk_fingpay_2fa_txn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fp_2fa_user_id ON fingpay_2fa_txn(user_id);
CREATE INDEX IF NOT EXISTS idx_fp_2fa_merchant_tran_id ON fingpay_2fa_txn(merchant_tran_id);
CREATE INDEX IF NOT EXISTS idx_fp_2fa_status ON fingpay_2fa_txn(response_code);

ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_ap_2fa_session_id VARCHAR(255);
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS aeps_ap_2fa_authenticated_at TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE users ADD COLUMN IF NOT EXISTS aeps_ap_2fa_session_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS aeps_ap_2fa_authenticated_at TIMESTAMP WITHOUT TIME ZONE;
