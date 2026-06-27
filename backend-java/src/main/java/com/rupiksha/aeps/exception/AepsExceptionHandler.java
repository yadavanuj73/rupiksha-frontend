package com.rupiksha.aeps.exception;

import com.rupiksha.aeps.dto.ErrorResponse;
import com.rupiksha.aeps.dto.ValidationError;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class AepsExceptionHandler {

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(ValidationException ex) {
        log.warn("AEPS Validation Error: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .success(false)
                .message(ex.getMessage())
                .errorCode("VALIDATION_ERROR")
                .correlationId(UUID.randomUUID().toString())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(AuthenticationException ex) {
        log.warn("AEPS Authentication Failure: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .success(false)
                .message(ex.getMessage())
                .errorCode("AUTHENTICATION_FAILED")
                .correlationId(UUID.randomUUID().toString())
                .build();
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(ApiTimeoutException.class)
    public ResponseEntity<ErrorResponse> handleApiTimeoutException(ApiTimeoutException ex) {
        log.error("AEPS Gateway Connection Timeout: {}", ex.getMessage(), ex);
        ErrorResponse response = ErrorResponse.builder()
                .success(false)
                .message("Upstream service is currently unresponsive. Please try again.")
                .errorCode("GATEWAY_TIMEOUT")
                .correlationId(UUID.randomUUID().toString())
                .build();
        return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).body(response);
    }

    @ExceptionHandler(ProviderException.class)
    public ResponseEntity<ErrorResponse> handleProviderException(ProviderException ex) {
        log.error("AEPS Upstream Provider Integration Failure: {}", ex.getMessage(), ex);
        ErrorResponse response = ErrorResponse.builder()
                .success(false)
                .message(ex.getMessage())
                .errorCode("PROVIDER_ERROR")
                .correlationId(UUID.randomUUID().toString())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(response);
    }

    @ExceptionHandler(AepsException.class)
    public ResponseEntity<ErrorResponse> handleAepsException(AepsException ex) {
        log.error("AEPS System Exception: {}", ex.getMessage(), ex);
        ErrorResponse response = ErrorResponse.builder()
                .success(false)
                .message(ex.getMessage())
                .errorCode("AEPS_SYSTEM_ERROR")
                .correlationId(UUID.randomUUID().toString())
                .build();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValidException(MethodArgumentNotValidException ex) {
        List<ValidationError> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> new ValidationError(err.getField(), err.getDefaultMessage()))
                .collect(Collectors.toList());

        log.warn("AEPS DTO Constraint Validation Error count: {}", errors.size());

        ErrorResponse response = ErrorResponse.builder()
                .success(false)
                .message("Payload constraint violations found")
                .errorCode("CONSTRAINT_VIOLATION")
                .correlationId(UUID.randomUUID().toString())
                .validationErrors(errors)
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        log.error("Unhandled Exception caught: {}", ex.getMessage(), ex);
        ErrorResponse response = ErrorResponse.builder()
                .success(false)
                .message("An unexpected system error occurred.")
                .errorCode("INTERNAL_SERVER_ERROR")
                .correlationId(UUID.randomUUID().toString())
                .build();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
