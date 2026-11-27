package com.rupiksha.backend.service;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class EmployeeAuthRateLimiter {

    private static final int MAX_ATTEMPTS_PER_IP = 20;
    private static final int MAX_ATTEMPTS_PER_ACCOUNT = 10;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Deque<Instant>> ipAttempts = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> accountAttempts = new ConcurrentHashMap<>();

    public void checkLoginAllowed(String clientIp, String identifier) {
        String ipKey = clientIp == null || clientIp.isBlank() ? "unknown" : clientIp.trim();
        if (isLimitExceeded(ipAttempts, ipKey, MAX_ATTEMPTS_PER_IP)) {
            throw new RateLimitExceededException("Too many login attempts from your IP. Please try again later.");
        }
        if (identifier != null && !identifier.isBlank()) {
            String acctKey = identifier.trim().toLowerCase();
            if (isLimitExceeded(accountAttempts, acctKey, MAX_ATTEMPTS_PER_ACCOUNT)) {
                throw new RateLimitExceededException("Too many failed login attempts. Please wait a few minutes before retrying.");
            }
        }
    }

    public void recordAttempt(String clientIp, String identifier) {
        String ipKey = clientIp == null || clientIp.isBlank() ? "unknown" : clientIp.trim();
        addAttempt(ipAttempts, ipKey);
        if (identifier != null && !identifier.isBlank()) {
            addAttempt(accountAttempts, identifier.trim().toLowerCase());
        }
    }

    public void clearAccountAttempts(String identifier) {
        if (identifier != null && !identifier.isBlank()) {
            accountAttempts.remove(identifier.trim().toLowerCase());
        }
    }

    private boolean isLimitExceeded(Map<String, Deque<Instant>> store, String key, int maxAttempts) {
        Deque<Instant> timestamps = store.get(key);
        if (timestamps == null) {
            return false;
        }
        Instant cutoff = Instant.now().minus(WINDOW);
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(cutoff)) {
                timestamps.pollFirst();
            }
            return timestamps.size() >= maxAttempts;
        }
    }

    private void addAttempt(Map<String, Deque<Instant>> store, String key) {
        Deque<Instant> timestamps = store.computeIfAbsent(key, k -> new ArrayDeque<>());
        Instant cutoff = Instant.now().minus(WINDOW);
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(cutoff)) {
                timestamps.pollFirst();
            }
            timestamps.addLast(Instant.now());
        }
    }
}
