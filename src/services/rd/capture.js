import { PID_OPTIONS_XML } from './constants';
import { parsePidDataXml } from './parser';
import { validateCaptureData } from './validator';
import { TimeoutError, CaptureCancelledError, RDServiceError } from './errors';

/**
 * Initiates the fingerprint biometric scan capture from the Mantra device.
 * Posts standard PidOptions XML to the discovered CAPTURE endpoint path.
 */
export async function captureBiometric(serviceConfig, customPidOptions = null) {
    if (!serviceConfig || !serviceConfig.baseUrl) {
        throw new Error('Service config is required for biometric capture');
    }

    const relativePath = serviceConfig.paths?.CAPTURE || '/rd/capture';
    const endpoint = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    const url = `${serviceConfig.baseUrl}${endpoint}`;

    const body = customPidOptions || PID_OPTIONS_XML;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml'
            },
            body: body
        });

        if (!response.ok) {
            throw new Error(`RD Service capture HTTP error: ${response.status}`);
        }

        const xmlText = await response.text();
        const parsed = parsePidDataXml(xmlText);

        // Map standard Mantra MFS110/MFS100 error codes
        if (parsed.errCode === '700') {
            throw new TimeoutError();
        }
        if (parsed.errCode === '720') {
            throw new CaptureCancelledError();
        }
        if (parsed.errCode !== '0') {
            throw new RDServiceError(`Biometric capture failed (Code ${parsed.errCode}): ${parsed.errInfo}`, 'CAPTURE_FAILED');
        }

        // Validate structure details (SessionKey, Hmac, quality Score)
        validateCaptureData(parsed);

        return parsed;
    } catch (e) {
        if (e instanceof TimeoutError || e instanceof CaptureCancelledError || e instanceof RDServiceError) {
            throw e;
        }
        console.error("Biometric capture network failure", e);
        throw new RDServiceError("Local browser communication failure with Mantra service: " + e.message, 'COMMUNICATION_FAILURE');
    }
}
