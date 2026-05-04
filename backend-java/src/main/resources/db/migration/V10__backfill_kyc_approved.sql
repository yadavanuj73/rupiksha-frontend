-- Backfill: set kycStatus=APPROVED for all already-approved/active users
-- so they are not re-prompted for KYC on next login.
UPDATE users
SET kyc_status = 'APPROVED'
WHERE status IN ('APPROVED', 'ACTIVE')
  AND (kyc_status IS NULL OR kyc_status IN ('NOT_SUBMITTED', 'PENDING'));
