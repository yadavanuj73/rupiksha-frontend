-- Migration V25: Add Fingpay AEPS Integration Tables

CREATE TABLE IF NOT EXISTS onboard_txn (
    id BIGSERIAL PRIMARY KEY,
    merchant_login_id VARCHAR(100),
    txn_id VARCHAR(100),
    status VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE IF NOT EXISTS ekyc_txn (
    id BIGSERIAL PRIMARY KEY,
    merchant_login_id VARCHAR(100),
    mobile VARCHAR(20),
    aadhaar_last4 VARCHAR(10),
    primary_key_id BIGINT,
    encode_fp_txn_id VARCHAR(255),
    resend_count INTEGER,
    status VARCHAR(50),
    txn_id VARCHAR(100),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    biometric_status VARCHAR(50),
    biometric_at TIMESTAMP WITHOUT TIME ZONE,
    biometric_data TEXT,
    biometric_data_expiry TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE IF NOT EXISTS fingbank (
    id BIGINT PRIMARY KEY,
    bank_name VARCHAR(255),
    iinno VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS iaepstxn (
    id BIGSERIAL PRIMARY KEY,
    uid BIGINT,
    type VARCHAR(50),
    txnid VARCHAR(100),
    ftxnin VARCHAR(100),
    amount DOUBLE PRECISION,
    status VARCHAR(50),
    message VARCHAR(255),
    aadhar VARCHAR(50),
    rrn VARCHAR(100),
    bank BIGINT,
    mobile VARCHAR(20),
    txnamount DOUBLE PRECISION,
    request TEXT,
    response TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aepskyc (
    id BIGSERIAL PRIMARY KEY,
    uid BIGINT,
    outlet VARCHAR(100),
    mpin VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS fingpay_users (
    id BIGSERIAL PRIMARY KEY,
    pin VARCHAR(50)
);

-- Seed standard test banks
INSERT INTO fingbank (id, bank_name, iinno) VALUES 
(1, 'State Bank of India', '607094'),
(2, 'ICICI Bank', '508534'),
(3, 'HDFC Bank', '607152'),
(4, 'Axis Bank', '607153'),
(5, 'Punjab National Bank', '607027')
ON CONFLICT (id) DO NOTHING;
