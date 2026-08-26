-- V33: Ensure wallets balance and locked_balance columns are NUMERIC(18,2) to match Hibernate entity validation
ALTER TABLE wallets ALTER COLUMN balance TYPE NUMERIC(18,2) USING balance::numeric(18,2);
ALTER TABLE wallets ALTER COLUMN locked_balance TYPE NUMERIC(18,2) USING locked_balance::numeric(18,2);
