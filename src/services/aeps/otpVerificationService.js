import { aepsService } from '../apiService';

/**
 * Service to delegate OTP verification requests.
 */
export const otpVerificationService = {
    /**
     * Submits the 6-digit verification code.
     */
    verifyKycOtp: async (otp, provider) => {
        if (!otp || otp.length !== 6) {
            throw new Error("Please enter a valid 6-digit OTP code.");
        }
        
        try {
            const response = await aepsService.verifyOtp(otp, provider);
            return response; // Contains: success, workflowState, message, providerReference, provider
        } catch (error) {
            console.error("AEPS OTP verification API execution failed", error);
            throw error;
        }
    }
};
