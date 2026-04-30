-- Widen KYC photo columns so frontend can submit full base64 data URLs.
ALTER TABLE users
    ALTER COLUMN photo_url TYPE TEXT,
    ALTER COLUMN aadhaar_photo_url TYPE TEXT,
    ALTER COLUMN pan_photo_url TYPE TEXT;
