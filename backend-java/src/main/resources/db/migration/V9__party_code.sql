-- Add party_code to store the approved network code assigned by admin.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS party_code VARCHAR(30);
