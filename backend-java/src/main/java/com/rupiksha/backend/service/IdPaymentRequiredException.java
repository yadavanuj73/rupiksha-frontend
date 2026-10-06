package com.rupiksha.backend.service;

import lombok.Getter;

@Getter
public class IdPaymentRequiredException extends RuntimeException {
    private final String userId;
    private final String username;
    private final String mobile;
    private final String fullName;
    private final String role;
    private final String paymentStatus;

    public IdPaymentRequiredException(String message, String userId, String username, String mobile, String fullName, String role, String paymentStatus) {
        super(message);
        this.userId = userId;
        this.username = username;
        this.mobile = mobile;
        this.fullName = fullName;
        this.role = role;
        this.paymentStatus = paymentStatus;
    }
}
