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
public class PayoutRateLimiter {

    public static final int USER_1M_MAX_ATTEMPTS = 3;
    public static final Duration USER_1M_WINDOW = Duration.ofMinutes(1);

    public static final int USER_1H_MAX_ATTEMPTS = 15;
    public static final Duration USER_1H_WINDOW = Duration.ofHours(1);

    public static final int IP_1M_MAX_ATTEMPTS = 10;
    public static final Duration IP_1M_WINDOW = Duration.ofMinutes(1);

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

    private final Map<String, LocalTracker> localUser1mTrackers = new ConcurrentHashMap<>();
    private final Map<String, LocalTracker> localUser1hTrackers = new ConcurrentHashMap<>();
    private final Map<String, LocalTracker> localIpTrackers = new ConcurrentHashMap<>();

    public void checkAndIncrement(String userId, String clientIp) {
        if (userId != null && !userId.isBlank()) {
            enforceUserLimits(userId.trim(), clientIp);
        }
        if (clientIp != null && !clientIp.isBlank() && !"unknown".equalsIgnoreCase(clientIp.trim()) && !"127.0.0.1".equals(clientIp.trim())) {
            enforceIpLimit(clientIp.trim(), userId);
        }
    }

    private void enforceUserLimits(String userId, String clientIp) {
        // 1. Minute Limit (Max 3/minute)
        String key1m = "ratelimit:payout:user:" + userId + ":1m";
        boolean redisSuccess1m = false;
        try {
            if (redisTemplate != null) {
                Long current = redisTemplate.opsForValue().increment(key1m);
                if (current != null) {
                    redisSuccess1m = true;
                    if (current == 1) {
                        redisTemplate.expire(key1m, USER_1M_WINDOW);
                    }
                    if (current > USER_1M_MAX_ATTEMPTS) {
                        log.warn("[SECURITY_ALERT] PAYOUT_RATE_LIMIT_EXCEEDED: userId={}, ip={}, count={}, limit=3/min",
                                userId, clientIp, current);
                        throw new RateLimitExceededException("Payout rate limit exceeded. You can initiate a maximum of 3 payouts per minute. Please wait before retrying.");
                    }
                }
            }
        } catch (RateLimitExceededException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis payout 1m rate limit check failed for user {}, falling back to local memory tracker: {}", userId, e.getMessage());
        }

        if (!redisSuccess1m) {
            LocalTracker tracker = localUser1mTrackers.computeIfAbsent(userId, k -> new LocalTracker());
            if (!tracker.tryAcquire(USER_1M_MAX_ATTEMPTS, USER_1M_WINDOW)) {
                log.warn("[SECURITY_ALERT] PAYOUT_RATE_LIMIT_EXCEEDED (Local): userId={}, ip={}, limit=3/min", userId, clientIp);
                throw new RateLimitExceededException("Payout rate limit exceeded. You can initiate a maximum of 3 payouts per minute. Please wait before retrying.");
            }
        }

        // 2. Hour Limit (Max 15/hour)
        String key1h = "ratelimit:payout:user:" + userId + ":1h";
        boolean redisSuccess1h = false;
        try {
            if (redisTemplate != null) {
                Long current = redisTemplate.opsForValue().increment(key1h);
                if (current != null) {
                    redisSuccess1h = true;
                    if (current == 1) {
                        redisTemplate.expire(key1h, USER_1H_WINDOW);
                    }
                    if (current > USER_1H_MAX_ATTEMPTS) {
                        log.warn("[SECURITY_ALERT] PAYOUT_RATE_LIMIT_EXCEEDED: userId={}, ip={}, count={}, limit=15/hr",
                                userId, clientIp, current);
                        throw new RateLimitExceededException("Hourly payout limit exceeded. You can initiate a maximum of 15 payouts per hour.");
                    }
                }
            }
        } catch (RateLimitExceededException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis payout 1h rate limit check failed for user {}, falling back to local memory tracker: {}", userId, e.getMessage());
        }

        if (!redisSuccess1h) {
            LocalTracker tracker = localUser1hTrackers.computeIfAbsent(userId, k -> new LocalTracker());
            if (!tracker.tryAcquire(USER_1H_MAX_ATTEMPTS, USER_1H_WINDOW)) {
                log.warn("[SECURITY_ALERT] PAYOUT_RATE_LIMIT_EXCEEDED (Local): userId={}, ip={}, limit=15/hr", userId, clientIp);
                throw new RateLimitExceededException("Hourly payout limit exceeded. You can initiate a maximum of 15 payouts per hour.");
            }
        }
    }

    private void enforceIpLimit(String ip, String userId) {
        String key = "ratelimit:payout:ip:" + ip + ":1m";
        try {
            if (redisTemplate != null) {
                Long current = redisTemplate.opsForValue().increment(key);
                if (current != null) {
                    if (current == 1) {
                        redisTemplate.expire(key, IP_1M_WINDOW);
                    }
                    if (current > IP_1M_MAX_ATTEMPTS) {
                        log.warn("[SECURITY_ALERT] PAYOUT_RATE_LIMIT_EXCEEDED: ip={}, userId={}, count={}, limit=10/min",
                                ip, userId, current);
                        throw new RateLimitExceededException("Too many payout requests from this IP address. Please wait a minute before retrying.");
                    }
                    return;
                }
            }
        } catch (RateLimitExceededException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis payout IP rate limit check failed for {}, falling back to local memory tracker", ip);
        }

        LocalTracker tracker = localIpTrackers.computeIfAbsent(ip, k -> new LocalTracker());
        if (!tracker.tryAcquire(IP_1M_MAX_ATTEMPTS, IP_1M_WINDOW)) {
            log.warn("[SECURITY_ALERT] PAYOUT_RATE_LIMIT_EXCEEDED (Local): ip={}, userId={}", ip, userId);
            throw new RateLimitExceededException("Too many payout requests from this IP address. Please wait a minute before retrying.");
        }
    }

    public void resetForTest(String userId) {
        if (userId != null) {
            localUser1mTrackers.remove(userId);
            localUser1hTrackers.remove(userId);
        }
        localIpTrackers.clear();
    }
}
