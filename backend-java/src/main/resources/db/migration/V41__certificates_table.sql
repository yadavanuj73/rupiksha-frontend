-- V41: Dynamic Rupiksha Certificate System table

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certificate_number VARCHAR(60) NOT NULL UNIQUE,
    party_code VARCHAR(30) NOT NULL,
    certificate_type VARCHAR(40) NOT NULL,
    role VARCHAR(40) NOT NULL,
    issued_on DATE NOT NULL,
    valid_till DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'VALID',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_party_code ON certificates(party_code);
CREATE INDEX IF NOT EXISTS idx_certificates_cert_number ON certificates(certificate_number);
