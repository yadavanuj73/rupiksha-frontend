-- V5: Store the retailer / distributor / super distributor business (shop) name
-- collected at registration. The admin approval screen displays this alongside
-- the applicant's legal name so the admin can disambiguate similar entries.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS business_name VARCHAR(120);
