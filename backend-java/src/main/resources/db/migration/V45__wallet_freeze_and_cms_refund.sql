-- V45: Wallet Freeze, CMS Refund, and Performance Indexes
-- Ensure indexes exist for high-volume wallet queries, fund requests, and audit ledger

CREATE INDEX IF NOT EXISTS idx_wallet_entries_context ON wallet_entries(transaction_context);
CREATE INDEX IF NOT EXISTS idx_wallet_entries_operator ON wallet_entries(operator_id);
CREATE INDEX IF NOT EXISTS idx_fund_requests_status ON fund_requests(status);
CREATE INDEX IF NOT EXISTS idx_fund_requests_user ON fund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator_id);
