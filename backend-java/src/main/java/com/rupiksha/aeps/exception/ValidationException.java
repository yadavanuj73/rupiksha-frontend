package com.rupiksha.aeps.exception;

/**
 * Exception thrown when the request payload fails business or format validation.
 */
public class ValidationException extends AepsException {
    public ValidationException(String message) {
        super(message);
    }
}
