package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.service.RateLimitExceededException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class RegistrationRateLimiter {
    public static final int IP_MAX_ATTEMPTS = 5;
    public static final Duration IP_WINDOW = Duration.ofMinutes(15);

    public static final int MOBILE_MAX_ATTEMPTS = 3;
    public static final Duration MOBILE_WINDOW = Duration.ofHours(1);

    private final StringRedisTemplate redisTemplate;

    private static class LocalTracker {
        private final Deque<Instant> timestamps = new ArrayDeque<>();

        synchronized boolean tryAcquire(int maxLimit, Duration window) {
            Instant cutoff = Instant.now().minus(window);
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(cutoff)) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxLimit) {
                return false;
            }
            timestamps.addLast(Instant.now());
            return true;
        }

        synchronized void reset() {
            timestamps.clear();
        }
    }

    private final Map<String, LocalTracker> localIpTrackers = new ConcurrentHashMap<>();
    private final Map<String, LocalTracker> localMobileTrackers = new ConcurrentHashMap<>();

    public void checkAndIncrement(String clientIp, String mobile) {
        if (clientIp != null && !clientIp.isBlank() && !"unknown".equalsIgnoreCase(clientIp.trim())) {
            enforceIpLimit(clientIp.trim());
        }

        if (mobile != null && !mobile.isBlank()) {
            String clean = cleanMobile(mobile);
            if (!clean.isBlank()) {
                enforceMobileLimit(clean);
            }
        }
    }

    private void enforceIpLimit(String ip) {
        String key = "ratelimit:register:ip:" + ip;
        try {
            Long current = redisTemplate.opsForValue().increment(key);
            if (current != null) {
                if (current == 1) {
                    redisTemplate.expire(key, IP_WINDOW);
                }
                if (current > IP_MAX_ATTEMPTS) {
                    log.warn("Registration IP rate limit exceeded: ip={}, count={}", ip, current);
                    throw new RateLimitExceededException("Too many registration attempts from this IP address. Please try again after 15 minutes.");
                }
                return;
            }
        } catch (RateLimitExceededException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis IP rate limit check failed for {}, falling back to local memory tracker", ip);
        }

        LocalTracker tracker = localIpTrackers.computeIfAbsent(ip, k -> new LocalTracker());
        if (!tracker.tryAcquire(IP_MAX_ATTEMPTS, IP_WINDOW)) {
            log.warn("Local registration IP rate limit exceeded: ip={}", ip);
            throw new RateLimitExceededException("Too many registration attempts from this IP address. Please try again after 15 minutes.");
        }
    }

    private void enforceMobileLimit(String mobile) {
        String key = "ratelimit:register:mobile:" + mobile;
        try {
            Long current = redisTemplate.opsForValue().increment(key);
            if (current != null) {
                if (current == 1) {
                    redisTemplate.expire(key, MOBILE_WINDOW);
                }
                if (current > MOBILE_MAX_ATTEMPTS) {
                    log.warn("Registration mobile rate limit exceeded: mobile={}, count={}", mobile, current);
                    throw new RateLimitExceededException("Too many registration attempts for this mobile number. Please try again after 1 hour.");
                }
                return;
            }
        } catch (RateLimitExceededException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis mobile rate limit check failed for {}, falling back to local memory tracker", mobile);
        }

        LocalTracker tracker = localMobileTrackers.computeIfAbsent(mobile, k -> new LocalTracker());
        if (!tracker.tryAcquire(MOBILE_MAX_ATTEMPTS, MOBILE_WINDOW)) {
            log.warn("Local registration mobile rate limit exceeded: mobile={}", mobile);
            throw new RateLimitExceededException("Too many registration attempts for this mobile number. Please try again after 1 hour.");
        }
    }

    public void resetForTesting() {
        localIpTrackers.clear();
        localMobileTrackers.clear();
    }

    private String cleanMobile(String raw) {
        if (raw == null) return "";
        String cleaned = raw.replaceAll("[^0-9]", "");
        if (cleaned.length() > 10) {
            cleaned = cleaned.substring(cleaned.length() - 10);
        }
        return cleaned;
    }
}
