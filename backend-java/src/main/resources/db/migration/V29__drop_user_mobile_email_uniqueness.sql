-- Migration V29: Drop uniqueness constraints on mobile and email columns
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_mobile_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
