import { aepsService } from '../apiService';

/**
 * Workflow service managing merchant biometric submit parameters.
 */
export const kycWorkflowService = {
    /**
     * Submits the captured PID XML block and biometric type to the backend.
     */
    submitBiometricKyc: async (pidXml, biometricType = 'FMR') => {
        if (!pidXml) {
            throw new Error("Biometric XML is required for KYC submission.");
        }
        
        try {
            const payload = {
                pidXml,
                biometricType
            };
            const response = await aepsService.submitKyc(payload);
            return response; // Contains: success, otpRequired, message, referenceId
        } catch (error) {
            console.error("Biometric KYC API execution failed", error);
            throw error;
        }
    }
};
