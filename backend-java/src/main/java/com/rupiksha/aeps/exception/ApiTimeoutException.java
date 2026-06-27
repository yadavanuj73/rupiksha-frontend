package com.rupiksha.aeps.exception;

/**
 * Exception thrown when the connection or read timeout expires with the provider.
 */
public class ApiTimeoutException extends AepsException {
    public ApiTimeoutException(String message) {
        super(message);
    }

    public ApiTimeoutException(String message, Throwable cause) {
        super(message, cause);
    }
}
