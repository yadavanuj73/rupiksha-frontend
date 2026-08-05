-- V28: Schema Consolidation, Default Constraints, Non-Null Guarantees & Performance Indexes

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Users Table Schema Integrity & Non-Null Guarantees
UPDATE users SET aeps_onboarded = FALSE WHERE aeps_onboarded IS NULL;
UPDATE users SET aeps_kyc_done = FALSE WHERE aeps_kyc_done IS NULL;
UPDATE users SET otp_verified = FALSE WHERE otp_verified IS NULL;
UPDATE users SET registration_status = 'APPROVED' WHERE registration_status IS NULL;
UPDATE users SET kyc_status = 'NOT_SUBMITTED' WHERE kyc_status IS NULL;
UPDATE users SET status = 'PENDING' WHERE status IS NULL;

ALTER TABLE users ALTER COLUMN aeps_onboarded SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN aeps_onboarded SET NOT NULL;

ALTER TABLE users ALTER COLUMN aeps_kyc_done SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN aeps_kyc_done SET NOT NULL;

ALTER TABLE users ALTER COLUMN otp_verified SET DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN otp_verified SET NOT NULL;

ALTER TABLE users ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE users ALTER COLUMN status SET NOT NULL;

ALTER TABLE users ALTER COLUMN kyc_status SET DEFAULT 'NOT_SUBMITTED';
ALTER TABLE users ALTER COLUMN kyc_status SET NOT NULL;

-- 3. Users Table B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_party_code ON users(party_code);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_reg_status ON users(registration_status);
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_users_aeps_agent ON users(aeps_agent_id);
CREATE INDEX IF NOT EXISTS idx_users_aeps_merchant ON users(aeps_merchant_id);

-- 4. Wallets & Ledger Performance Indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_entries_wallet_id ON wallet_entries(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_entries_operator_id ON wallet_entries(operator_id);
CREATE INDEX IF NOT EXISTS idx_wallet_entries_created_at ON wallet_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_entries_idempotency ON wallet_entries(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_wallet_entries_reference ON wallet_entries(reference_id);

-- 5. User Services Indexes
CREATE INDEX IF NOT EXISTS idx_user_services_user_id ON user_services(user_id);
CREATE INDEX IF NOT EXISTS idx_user_services_type ON user_services(service_type);
CREATE INDEX IF NOT EXISTS idx_user_services_enabled ON user_services(is_enabled);

-- 6. Transactions & Payouts Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_aeps_engine_txnid ON aeps_transaction_engine(transaction_id);
CREATE INDEX IF NOT EXISTS idx_aeps_engine_ref ON aeps_transaction_engine(reference_number);
CREATE INDEX IF NOT EXISTS idx_aeps_engine_user_id ON aeps_transaction_engine(user_id);
CREATE INDEX IF NOT EXISTS idx_aeps_engine_status ON aeps_transaction_engine(status);
CREATE INDEX IF NOT EXISTS idx_aeps_engine_initiated ON aeps_transaction_engine(initiated_at);

CREATE INDEX IF NOT EXISTS idx_payout_order_id ON payout_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payout_user_id ON payout_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_status ON payout_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payout_utr ON payout_transactions(utr);
CREATE INDEX IF NOT EXISTS idx_payout_created ON payout_transactions(created_at);

-- 7. Fund Requests & Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_fund_requests_user_id ON fund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_requests_status ON fund_requests(status);
CREATE INDEX IF NOT EXISTS idx_fund_requests_utr ON fund_requests(utr_number);
CREATE INDEX IF NOT EXISTS idx_fund_requests_created ON fund_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ref ON audit_logs(reference_number);

-- 8. AEPS Agent Profile & Legacy Tables Indexes
CREATE INDEX IF NOT EXISTS idx_aeps_users_mobile ON aeps_users(mobile);
CREATE INDEX IF NOT EXISTS idx_agent_profile_mobile ON agent_profile(mobile);
CREATE INDEX IF NOT EXISTS idx_aeps_kyc_hist_status ON aeps_kyc_history(status);
CREATE INDEX IF NOT EXISTS idx_aeps_txn_hist_status ON aeps_transaction_history(status);
CREATE INDEX IF NOT EXISTS idx_iaepstxn_txnid ON iaepstxn(txnid);
CREATE INDEX IF NOT EXISTS idx_iaepstxn_mobile ON iaepstxn(mobile);
