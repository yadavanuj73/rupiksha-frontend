package com.rupiksha.aeps.exception;

/**
 * Exception thrown when API security, key, or token validation fails.
 */
public class AuthenticationException extends AepsException {
    public AuthenticationException(String message) {
        super(message);
    }
}
