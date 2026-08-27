-- Migration V35: Add approval workflow fields to payout_beneficiaries
ALTER TABLE payout_beneficiaries 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

ALTER TABLE payout_beneficiaries 
ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500);

ALTER TABLE payout_beneficiaries 
ADD COLUMN IF NOT EXISTS actioned_at TIMESTAMP;

ALTER TABLE payout_beneficiaries 
ADD COLUMN IF NOT EXISTS actioned_by VARCHAR(100);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_payout_bene_status ON payout_beneficiaries(status);
CREATE INDEX IF NOT EXISTS idx_payout_bene_user_status ON payout_beneficiaries(user_id, status);

COMMENT ON COLUMN payout_beneficiaries.status IS 'Approval status: PENDING, APPROVED, REJECTED';
COMMENT ON COLUMN payout_beneficiaries.rejection_reason IS 'Reason provided by admin if rejected';
