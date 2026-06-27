import { aepsService } from '../apiService';

/**
 * Service to delegate Daily 2FA authentication requests.
 */
export const daily2faService = {
    /**
     * Submits captured biometric data and coordinates for daily 2FA verification.
     */
    authenticate: async (pidXml, latitude, longitude, biometricType = 'FMR') => {
        if (!pidXml) {
            throw new Error("Fingerprint biometric PID data is required.");
        }
        if (!latitude || !longitude) {
            throw new Error("GPS coordinates (latitude & longitude) are required for location validation.");
        }
        
        try {
            const response = await aepsService.dailyAuthenticate({
                pidXml,
                latitude: String(latitude),
                longitude: String(longitude),
                biometricType
            });
            return response; // Contains: success, workflowState, message, providerReference, provider
        } catch (error) {
            console.error("AEPS Daily 2FA API execution failed", error);
            throw error;
        }
    }
};
