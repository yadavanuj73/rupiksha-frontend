package com.rupiksha.aeps.provider.fingpay.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(FingpayException.class)   // ⭐ CHANGED
    public ResponseEntity<?> handleFingpay(FingpayException e){
        return ResponseEntity.status(502).body(e.getMessage());   // ⭐ CHANGED
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handle(Exception e){
        return ResponseEntity.internalServerError().body("Something went wrong");
    }
}
