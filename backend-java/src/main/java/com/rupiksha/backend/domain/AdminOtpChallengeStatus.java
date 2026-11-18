package com.rupiksha.backend.domain;

public enum AdminOtpChallengeStatus {
    PENDING,
    VERIFIED,
    EXPIRED,
    MAX_ATTEMPTS_EXCEEDED,
    SUPERSEDED,
    BLOCKED
}
