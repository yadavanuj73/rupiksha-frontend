import { ValidationError } from './errors';

/**
 * Validates parsed biometric capture data according to UIDAI/NPCI specs.
 */
export function validateCaptureData(parsedData) {
    if (!parsedData) {
        throw new ValidationError("No capture data received for validation.");
    }

    const { errCode, errInfo, quality, hasSkey, hasHmac, hasDeviceInfo } = parsedData;

    // errCode = 0 represents capture success
    if (errCode !== '0') {
        throw new ValidationError(`Biometric capture failed (Code ${errCode}): ${errInfo || 'Unknown device error'}`);
    }

    // Minimum biometric quality check (Standard benchmark is >= 40%)
    if (quality < 40) {
        throw new ValidationError(`Biometric quality score too low: ${quality}% (Required: >= 40%). Please scan again.`);
    }

    if (!hasSkey) {
        throw new ValidationError("Biometric payload validation failed: Missing Session Key (Skey).");
    }

    if (!hasHmac) {
        throw new ValidationError("Biometric payload validation failed: Missing cryptographic HMAC node.");
    }

    if (!hasDeviceInfo) {
        throw new ValidationError("Biometric payload validation failed: Missing local Device Info parameters.");
    }

    return true;
}
