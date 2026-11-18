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

    @ExceptionHandler(com.rupiksha.backend.service.RateLimitExceededException.class)
    public ResponseEntity<?> handleRateLimitExceeded(com.rupiksha.backend.service.RateLimitExceededException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(base(HttpStatus.TOO_MANY_REQUESTS, ex.getMessage()));
    }

    @ExceptionHandler(com.rupiksha.backend.service.IdPaymentRequiredException.class)
    public ResponseEntity<?> handleIdPaymentRequired(com.rupiksha.backend.service.IdPaymentRequiredException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("success", false);
        body.put("code", "ID_PAYMENT_REQUIRED");
        body.put("message", ex.getMessage());
        body.put("paymentStatus", ex.getPaymentStatus());
        body.put("userId", ex.getUserId());
        body.put("username", ex.getUsername());
        body.put("mobile", ex.getMobile());
        body.put("fullName", ex.getFullName());
        body.put("role", ex.getRole());

        
