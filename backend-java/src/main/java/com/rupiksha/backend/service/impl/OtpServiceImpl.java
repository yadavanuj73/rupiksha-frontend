package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.OtpDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.service.OtpService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class OtpServiceImpl implements OtpService {
    public static final int MAX_ATTEMPTS = 5;
    public static final long RESEND_COOLDOWN_SECONDS = 60;
    public static final Duration OTP_TTL = Duration.ofMinutes(5);
    public static final Duration REGISTRATION_OTP_WINDOW = Duration.ofMinutes(15);

    private final StringRedisTemplate redisTemplate;
    private final OtpProviderRouter otpProviderRouter;
    private final AppProperties appProperties;

    private record ExpiringValue(String value, Instant expiresAt) {
        boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }

    private final Map<String, ExpiringValue> localOtpCache = new ConcurrentHashMap<>();
    private final Map<String, ExpiringValue> localRegVerifiedCache = new ConcurrentHashMap<>();
    private final Map<String, Integer> localAttemptCache = new ConcurrentHashMap<>();
    private final Map<String, Instant> localCooldownCache = new ConcurrentHashMap<>();

    @Override
    public OtpDtos.OtpResponse sendOtp(OtpDtos.SendOtpRequest request) {
        String mobile = cleanMobileNumber(request.mobile());
        if (mobile.length() != 10) {
            return new OtpDtos.OtpResponse(false, "Invalid mobile number. Exactly 10 digits required.");
        }

        // Check 60s cooldown
        String cooldownKey = "otp:cooldown:" + mobile;
        if (isCooldownActive(cooldownKey, mobile)) {
            return new OtpDtos.OtpResponse(false, "Please wait 60 seconds before requesting a new OTP.");
        }

        var provider = otpProviderRouter.current();
        String refKey = "otp:ref:" + mobile;
        String attemptKey = "otp:attempts:" + mobile;

        log.info("Requesting OTP send for mobile {} using provider {}", mobile, provider.providerName());
        try {
            String reference = provider.sendOtp(mobile);
            storeRef(refKey, reference);
            setCooldown(cooldownKey, mobile);
            resetAttempts(attemptKey, mobile);
            return new OtpDtos.OtpResponse(true, "OTP sent successfully");
        } catch (Exception e) {
            log.error("Failed to send OTP to mobile {}: {}", mobile, e.getMessage(), e);
            return new OtpDtos.OtpResponse(false, "Failed to send OTP: " + e.getMessage());
        }
    }

    @Override
    public OtpDtos.OtpResponse verifyOtp(OtpDtos.VerifyOtpRequest request) {
        String mobile = cleanMobileNumber(request.mobile());
        if (mobile.length() != 10) {
            return new OtpDtos.OtpResponse(false, "Invalid mobile number. Exactly 10 digits required.");
        }

        String submittedOtp = request.otp() != null ? request.otp().trim() : "";
        if (!submittedOtp.matches("^\\d{6}$")) {
            return new OtpDtos.OtpResponse(false, "OTP must be exactly 6 digits.");
        }

        String refKey = "otp:ref:" + mobile;
        String attemptKey = "otp:attempts:" + mobile;

        int attempts = getAttempts(attemptKey, mobile);
        if (attempts >= MAX_ATTEMPTS) {
            removeRef(refKey);
            return new OtpDtos.OtpResponse(false, "Maximum verification attempts exceeded. Please request a new OTP.");
        }

        String reference = getRef(refKey);
        var provider = otpProviderRouter.current();

        if (reference == null || reference.isBlank()) {
            if ("mock".equalsIgnoreCase(provider.providerName())) {
                boolean mockOk = provider.verifyOtp(mobile, submittedOtp, mobile);
                if (mockOk) {
                    log.info("Mock provider OTP verified for mobile {}", mobile);
                    storeRegistrationVerified(mobile, submittedOtp);
                    return new OtpDtos.OtpResponse(true, "OTP verified successfully");
                }
            }
            return new OtpDtos.OtpResponse(false, "OTP expired or invalid session");
        }

        boolean ok = provider.verifyOtp(mobile, submittedOtp, reference);
        if (!ok) {
            incrementAttempts(attemptKey, mobile);
            int remaining = MAX_ATTEMPTS - (attempts + 1);
            if (remaining <= 0) {
                removeRef(refKey);
                return new OtpDtos.OtpResponse(false, "Maximum verification attempts exceeded. Please request a new OTP.");
            }
            return new OtpDtos.OtpResponse(false, "Invalid OTP");
        }

        // Single-use: remove session challenge upon successful verification
        removeRef(refKey);
        resetAttempts(attemptKey, mobile);
        storeRegistrationVerified(mobile, submittedOtp);
        return new OtpDtos.OtpResponse(true, "OTP verified successfully");
    }

    @Override
    public OtpDtos.OtpResponse resendOtp(OtpDtos.SendOtpRequest request) {
        return sendOtp(request);
    }

    @Override
    public boolean verifyAndConsumeRegistration(String rawMobile, String rawOtp) {
        String mobile = cleanMobileNumber(rawMobile);
        if (mobile.isBlank()) {
            log.warn("Registration OTP verification failed: mobile number is empty");
            return false;
        }

        String submittedOtp = rawOtp != null ? rawOtp.trim() : "";

        // Path 1: Check pre-verified registration token from verifyOtp
        String storedOtp = getRegVerified(mobile);
        if (storedOtp != null) {
            if (!submittedOtp.isBlank() && !storedOtp.isBlank() && !storedOtp.equals("VERIFIED") && !storedOtp.equals(submittedOtp)) {
                log.warn("Registration OTP mismatch for mobile {}", mobile);
                return false;
            }
            // Atomically consume the verification so it cannot be reused
            removeRegVerified(mobile);
            log.info("Registration OTP verification consumed successfully for mobile {}", mobile);
            return true;
        }

        // Path 2: Direct OTP verification fallback (if client provided OTP directly in register payload)
        if (!submittedOtp.isBlank() && submittedOtp.matches("^\\d{6}$")) {
            String refKey = "otp:ref:" + mobile;
            String reference = getRef(refKey);
            var provider = otpProviderRouter.current();

            if (reference != null && !reference.isBlank()) {
                boolean ok = provider.verifyOtp(mobile, submittedOtp, reference);
                if (ok) {
                    removeRef(refKey);
                    log.info("Direct registration OTP verified and consumed for mobile {}", mobile);
                    return true;
                }
            } else if ("mock".equalsIgnoreCase(provider.providerName())) {
                boolean mockOk = provider.verifyOtp(mobile, submittedOtp, mobile);
                if (mockOk) {
                    log.info("Direct mock registration OTP verified for mobile {}", mobile);
                    return true;
                }
            }
        }

        log.warn("Registration OTP verification failed or expired for mobile {}", mobile);
        return false;
    }

    private void storeRegistrationVerified(String mobile, String otp) {
        String key = "reg:verified:" + mobile;
        String val = otp != null && !otp.isBlank() ? otp : "VERIFIED";
        try {
            if (redisTemplate != null) {
                redisTemplate.opsForValue().set(key, val, REGISTRATION_OTP_WINDOW);
            }
        } catch (Exception e) {
            log.warn("Redis store failed for {}, using local fallback", key);
        }
        localRegVerifiedCache.put(mobile, new ExpiringValue(val, Instant.now().plus(REGISTRATION_OTP_WINDOW)));
    }

    private String getRegVerified(String mobile) {
        String key = "reg:verified:" + mobile;
        try {
            if (redisTemplate != null) {
                String val = redisTemplate.opsForValue().get(key);
                if (val != null) return val;
            }
        } catch (Exception e) {
            log.warn("Redis read failed for {}, using local fallback", key);
        }
        ExpiringValue entry = localRegVerifiedCache.get(mobile);
        if (entry != null) {
            if (!entry.isExpired()) {
                return entry.value();
            }
            localRegVerifiedCache.remove(mobile);
        }
        return null;
    }

    private void removeRegVerified(String mobile) {
        String key = "reg:verified:" + mobile;
        try {
            if (redisTemplate != null) {
                redisTemplate.delete(key);
            }
        } catch (Exception e) {
            log.warn("Redis delete failed for {}", key);
        }
        localRegVerifiedCache.remove(mobile);
    }

    private void storeRef(String key, String reference) {
        Duration ttl = (appProperties != null && appProperties.otp() != null && appProperties.otp().ttlSeconds() > 0)
                ? Duration.ofSeconds(appProperties.otp().ttlSeconds())
                : OTP_TTL;
        try {
            if (redisTemplate != null) {
                redisTemplate.opsForValue().set(key, reference, ttl);
            }
        } catch (Exception e) {
            log.warn("Redis store failed, using in-memory fallback for key {}", key);
        }
        localOtpCache.put(key, new ExpiringValue(reference, Instant.now().plus(ttl)));
    }

    private String getRef(String key) {
        try {
            if (redisTemplate != null) {
                String val = redisTemplate.opsForValue().get(key);
                if (val != null) return val;
            }
        } catch (Exception e) {
            log.warn("Redis read failed, using in-memory fallback for key {}", key);
        }
        ExpiringValue entry = localOtpCache.get(key);
        if (entry != null) {
            if (!entry.isExpired()) {
                return entry.value();
            }
            localOtpCache.remove(key);
        }
        return null;
    }

    private void removeRef(String key) {
        try {
            if (redisTemplate != null) {
                redisTemplate.delete(key);
            }
        } catch (Exception e) {
            log.warn("Redis delete failed for key {}", key);
        }
        localOtpCache.remove(key);
    }

    private boolean isCooldownActive(String key, String mobile) {
        try {
            if (redisTemplate != null) {
                Boolean hasKey = redisTemplate.hasKey(key);
                if (Boolean.TRUE.equals(hasKey)) return true;
            }
        } catch (Exception e) {
            log.warn("Redis check failed for cooldown key {}", key);
        }
        Instant cooldownUntil = localCooldownCache.get(mobile);
        if (cooldownUntil != null) {
            if (Instant.now().isBefore(cooldownUntil)) {
                return true;
            }
            localCooldownCache.remove(mobile);
        }
        return false;
    }

    private void setCooldown(String key, String mobile) {
        try {
            if (redisTemplate != null) {
                redisTemplate.opsForValue().set(key, "1", Duration.ofSeconds(RESEND_COOLDOWN_SECONDS));
            }
        } catch (Exception e) {
            log.warn("Redis set failed for cooldown key {}", key);
        }
        localCooldownCache.put(mobile, Instant.now().plusSeconds(RESEND_COOLDOWN_SECONDS));
    }

    private int getAttempts(String key, String mobile) {
        try {
            if (redisTemplate != null) {
                String val = redisTemplate.opsForValue().get(key);
                if (val != null) {
                    return Integer.parseInt(val);
                }
            }
        } catch (Exception e) {
            log.warn("Redis read failed for attempt key {}", key);
        }
        return localAttemptCache.getOrDefault(mobile, 0);
    }

    private void incrementAttempts(String key, String mobile) {
        int current = getAttempts(key, mobile) + 1;
        try {
            if (redisTemplate != null) {
                redisTemplate.opsForValue().set(key, String.valueOf(current), OTP_TTL);
            }
        } catch (Exception e) {
            log.warn("Redis update failed for attempt key {}", key);
        }
        localAttemptCache.put(mobile, current);
    }

    private void resetAttempts(String key, String mobile) {
        try {
            if (redisTemplate != null) {
                redisTemplate.delete(key);
            }
        } catch (Exception e) {
            log.warn("Redis delete failed for attempt key {}", key);
        }
        localAttemptCache.remove(mobile);
    }

    private String cleanMobileNumber(String raw) {
        if (raw == null) return "";
        String cleaned = raw.replaceAll("[^0-9]", "");
        if (cleaned.length() > 10) {
            cleaned = cleaned.substring(cleaned.length() - 10);
        }
        return cleaned;
    }
}
