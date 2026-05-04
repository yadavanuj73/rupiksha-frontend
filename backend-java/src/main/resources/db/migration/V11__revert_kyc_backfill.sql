-- Revert V10 backfill: reset kycStatus back to NOT_SUBMITTED for users
-- who were incorrectly marked APPROVED without actually submitting KYC documents.
-- Only resets users where aadhaar_number and pan_number are both empty/null
-- (i.e., no real KYC docs were submitted).
UPDATE users
SET kyc_status = 'NOT_SUBMITTED'
WHERE kyc_status = 'APPROVED'
  AND (aadhaar_number IS NULL OR aadhaar_number = '')
  AND (pan_number IS NULL OR pan_number = '');
