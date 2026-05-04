-- Fix any rows where kyc_status is NULL (causes NPE in Java .name() calls)
UPDATE users
SET kyc_status = 'NOT_SUBMITTED'
WHERE kyc_status IS NULL;
