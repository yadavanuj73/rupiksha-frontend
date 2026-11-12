package com.rupiksha.backend.domain;

public enum OtpChallengeStatus {
    PENDING,
    VERIFIED,
    EXPIRED,
    MAX_ATTEMPTS_EXCEEDED,
    SUPERSEDED
}

