-- AEPS module tables

CREATE TABLE IF NOT EXISTS aeps_users (
    id BIGSERIAL PRIMARY KEY,
    mobile VARCHAR(20),
    aadhaar VARCHAR(20),
    name VARCHAR(120),
    email VARCHAR(120),
    pan VARCHAR(20),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pin_code VARCHAR(10),
    shop_name VARCHAR(150),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_profile (
    id BIGSERIAL PRIMARY KEY,
    mobile VARCHAR(20),
    agent_id VARCHAR(50),
    merchant_id VARCHAR(50),
    name VARCHAR(120),
    shop_name VARCHAR(150),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pin_code VARCHAR(10),
    latitude VARCHAR(30),
    longitude VARCHAR(30),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_log (
    id BIGSERIAL PRIMARY KEY,
    mobile VARCHAR(20),
    otp VARCHAR(10),
    expiry TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS aeps_transaction (
    id BIGSERIAL PRIMARY KEY,
    mobile VARCHAR(20),
    agent_id VARCHAR(50),
    amount VARCHAR(20),
    bank_name VARCHAR(100),
    status VARCHAR(30),
    rrn VARCHAR(50),
    txn_id VARCHAR(80),
    created_at VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_aeps_txn_mobile ON aeps_transaction(mobile);
CREATE INDEX IF NOT EXISTS idx_agent_profile_mobile ON agent_profile(mobile);
