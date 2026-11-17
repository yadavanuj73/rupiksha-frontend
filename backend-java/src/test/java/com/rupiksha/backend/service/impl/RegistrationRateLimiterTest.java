package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.service.RateLimitExceededException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RegistrationRateLimiterTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private RegistrationRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        rateLimiter = new RegistrationRateLimiter(redisTemplate);
    }

    @Test
    @DisplayName("IP rate limit allows up to 5 attempts then blocks 6th")
    void ipRateLimit_exceeded_throwsException() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(eq("ratelimit:register:ip:192.168.1.100")))
                .thenReturn(1L, 2L, 3L, 4L, 5L, 6L);

        // 5 allowed attempts
        for (int i = 0; i < 5; i++) {
            assertThatCode(() -> rateLimiter.checkAndIncrement("192.168.1.100", null))
                    .doesNotThrowAnyException();
        }

        // 6th attempt blocked
        assertThatThrownBy(() -> rateLimiter.checkAndIncrement("192.168.1.100", null))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessageContaining("Too many registration attempts from this IP address");
    }

    @Test
    @DisplayName("Mobile rate limit allows up to 3 attempts then blocks 4th")
    void mobileRateLimit_exceeded_throwsException() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(eq("ratelimit:register:mobile:9876543210")))
                .thenReturn(1L, 2L, 3L, 4L);

        // 3 allowed attempts
        for (int i = 0; i < 3; i++) {
            assertThatCode(() -> rateLimiter.checkAndIncrement(null, "9876543210"))
                    .doesNotThrowAnyException();
        }

        // 4th attempt blocked
        assertThatThrownBy(() -> rateLimiter.checkAndIncrement(null, "9876543210"))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessageContaining("Too many registration attempts for this mobile number");
    }

    @Test
    @DisplayName("In-memory fallback works when Redis is down")
    void fallbackToLocal_whenRedisUnavailable() {
        RegistrationRateLimiter localOnlyLimiter = new RegistrationRateLimiter(null);

        // 5 allowed IP attempts
        for (int i = 0; i < 5; i++) {
            assertThatCode(() -> localOnlyLimiter.checkAndIncrement("10.0.0.5", null))
                    .doesNotThrowAnyException();
        }

        // 6th attempt blocked by local tracker
        assertThatThrownBy(() -> localOnlyLimiter.checkAndIncrement("10.0.0.5", null))
                .isInstanceOf(RateLimitExceededException.class);
    }
}
