package com.rupiksha.backend.api;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, Object> body = base(HttpStatus.BAD_REQUEST, "Validation failed");
        ex.getBindingResult().getFieldErrors().forEach(err ->
                ((Map<String, String>) body.get("errors")).put(err.getField(), err.getDefaultMessage()));
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<?> handleConstraint(ConstraintViolationException ex) {
        return ResponseEntity.badRequest().body(base(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> handleForbidden(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(base(HttpStatus.FORBIDDEN, "Access denied"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(base(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(com.rupiksha.aeps.exception.ValidationException.class)
    public ResponseEntity<?> handleAepsValidation(com.rupiksha.aeps.exception.ValidationException ex) {
        return ResponseEntity.badRequest().body(base(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(com.rupiksha.aeps.exception.AepsException.class)
    public ResponseEntity<?> handleAepsException(com.rupiksha.aeps.exception.AepsException ex) {
        return ResponseEntity.badRequest().body(base(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleGeneric(Exception ex) {
        // Log full stack trace so Render logs show the real cause
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        // Surface root cause message to client (helps during dev/staging)
        String cause = ex.getMessage();
        Throwable root = ex;
        while (root.getCause() != null) root = root.getCause();
        if (root != ex && root.getMessage() != null) cause = root.getMessage();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(base(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Internal server error: " + (cause != null ? cause : ex.getClass().getSimpleName())));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> base(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("message", message);
        body.put("errors", new HashMap<String, String>());
        return body;
    }
}

