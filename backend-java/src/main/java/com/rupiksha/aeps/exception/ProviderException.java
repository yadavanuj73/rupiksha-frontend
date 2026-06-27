package com.rupiksha.aeps.exception;

/**
 * Exception thrown when the upstream provider returns an error or fails.
 */
public class ProviderException extends AepsException {
    public ProviderException(String message) {
        super(message);
    }

    public ProviderException(String message, Throwable cause) {
        super(message, cause);
    }
}
