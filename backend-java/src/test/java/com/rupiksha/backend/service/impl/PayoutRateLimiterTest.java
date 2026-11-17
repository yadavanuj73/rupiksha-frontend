package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.service.RateLimitExceededException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PayoutRateLimiterTest {

    private PayoutRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        // Test with in-memory fallback (null RedisTemplate)
        rateLimiter = new PayoutRateLimiter(null);
    }

    @Test
    @DisplayName("Should allow up to 3 payout requests per minute per user")
    void testUserRateLimitingAllowed() {
        String userId = "user-123";
        String ip = "192.168.1.10";

        assertDoesNotThrow(() -> rateLimiter.checkAndIncrement(userId, ip));
        assertDoesNotThrow(() -> rateLimiter.checkAndIncrement(userId, ip));
        assertDoesNotThrow(() -> rateLimiter.checkAndIncrement(userId, ip));
    }

    @Test
    @DisplayName("Should block 4th payout request within a minute for the same user with HTTP 429 RateLimitExceededException")
    void testUserRateLimitingBlocked() {
        String userId = "user-456";
        String ip = "192.168.1.20";

        assertDoesNotThrow(() -> rateLimiter.checkAndIncrement(userId, ip));
        assertDoesNotThrow(() -> rateLimiter.checkAndIncrement(userId, ip));
        assertDoesNotThrow(() -> rateLimiter.checkAndIncrement(userId, ip));

        RateLimitExceededException ex = assertThrows(RateLimitExceededException.class, () ->
                rateLimiter.checkAndIncrement(userId, ip));

        assertTrue(ex.getMessage().contains("Payout rate limit exceeded"));
    }

    @Test
    @DisplayName("Should block rapid requests exceeding IP rate limit with HTTP 429 RateLimitExceededException")
    void testIpRateLimitingBlocked() {
        String ip = "10.0.0.99";

        // 10 distinct users from same IP
        for (int i = 1; i <= 10; i++) {
            final String u = "user-ip-" + i;
            assertDoesNotThrow(() -> rateLimiter.checkAndIncrement(u, ip));
        }

        // 11th request from same IP should be blocked
        RateLimitExceededException ex = assertThrows(RateLimitExceededException.class, () ->
                rateLimiter.checkAndIncrement("user-ip-11", ip));

        assertTrue(ex.getMessage().contains("IP address"));
    }
}
