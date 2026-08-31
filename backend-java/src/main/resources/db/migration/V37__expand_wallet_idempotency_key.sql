-- Expand idempotency_key column in wallet_entries and transactions to VARCHAR(255)
-- to prevent truncation errors with long composite idempotency keys (e.g. plan upgrade, commission distributions)
ALTER TABLE wallet_entries ALTER COLUMN idempotency_key TYPE VARCHAR(255);
ALTER TABLE transactions ALTER COLUMN idempotency_key TYPE VARCHAR(255);
