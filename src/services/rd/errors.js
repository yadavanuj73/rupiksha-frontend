/**
 * Custom Error Hierarchies for RD Biometric Handshake
 */

export class RDServiceError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
    }
}

export class RDServiceNotFoundError extends RDServiceError {
    constructor(message = 'Registered Device (RD) Service driver is not running on localhost.') {
        super(message, 'RD_SERVICE_NOT_FOUND');
    }
}

export class DeviceDisconnectedError extends RDServiceError {
    constructor(message = 'Biometric device is unplugged or disconnected.') {
        super(message, 'DEVICE_DISCONNECTED');
    }
}

export class CaptureCancelledError extends RDServiceError {
    constructor(message = 'Biometric capture cancelled by the merchant/user.') {
        super(message, 'CAPTURE_CANCELLED');
    }
}

export class TimeoutError extends RDServiceError {
    constructor(message = 'Fingerprint scan timeout expired. No input received.') {
        super(message, 'CAPTURE_TIMEOUT');
    }
}

export class ValidationError extends RDServiceError {
    constructor(message = 'Captured biometrics failed structure XML validations.') {
        super(message, 'VALIDATION_FAILED');
    }
}
