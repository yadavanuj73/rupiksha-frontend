package com.rupiksha.aeps.dto.request;

import lombok.Data;

/**
 * Request payload for the Bank eKYC biometric submission endpoint.
 * The pidXml is the raw captured fingerprint XML from the RD service.
 */
@Data
public class BankEkycRequest {

    /** Raw PID XML from the Mantra RD service biometric capture. */
    private String pidXml;

    /** AEPS provider name (e.g. "fingpay"). */
    private String provider;

    /** Optional biometric type (default FMR). */
    private String biometricType = "FMR";
}
