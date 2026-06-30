-- Add dob column to aeps_users table
ALTER TABLE aeps_users ADD COLUMN IF NOT EXISTS dob VARCHAR(20);
