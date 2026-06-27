package com.rupiksha.aeps.exception;

/**
 * Base exception for all AEPS operations.
 */
public class AepsException extends RuntimeException {
    public AepsException(String message) {
        super(message);
    }

    public AepsException(String message, Throwable cause) {
        super(message, cause);
    }
}
