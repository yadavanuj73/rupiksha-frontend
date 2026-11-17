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
    private static final Duration REGISTRATION_OTP_WINDOW = Duration.ofMinutes(15);
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

    @Override
    public OtpDtos.OtpResponse sendOtp(OtpDtos.SendOtpRequest request) {
        String mobile = cleanMobileNumber(request.mobile());
        var provider = otpProviderRouter.current();
        String key = "otp:ref:" + mobile;
        log.info("Requesting OTP send for mobile {} using provider {}", mobile, provider.providerName());
        String reference = provider.sendOtp(mobile);
        storeRef(key, reference);
        return new OtpDtos.OtpResponse(true, "OTP sent successfully");
    }

    @Override
    public OtpDtos.OtpResponse verifyOtp(OtpDtos.VerifyOtpRequest request) {
        String mobile = cleanMobileNumber(request.mobile());
        String submittedOtp = request.otp() != null ? request.otp().trim() : "";
        var provider = otpProviderRouter.current();
        String key = "otp:ref:" + mobile;
        String reference = getRef(key);

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
            return new OtpDtos.OtpResponse(false, "Invalid OTP");
        }

        removeRef(key);
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
        String regKey = "reg:verified:" + mobile;

        // Path 1: Check pre-verified registration token from verifyOtp (RegisterWizard step 2 -> step 3)
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
        if (!submittedOtp.isBlank()) {
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
            redisTemplate.opsForValue().set(key, val, REGISTRATION_OTP_WINDOW);
        } catch (Exception e) {
            log.warn("Redis store failed for {}, using local fallback", key);
        }
        localRegVerifiedCache.put(mobile, new ExpiringValue(val, Instant.now().plus(REGISTRATION_OTP_WINDOW)));
    }

    private String getRegVerified(String mobile) {
        String key = "reg:verified:" + mobile;
        try {
            String val = redisTemplate.opsForValue().get(key);
            if (val != null) return val;
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
            redisTemplate.delete(key);
        } catch (Exception e) {
            log.warn("Redis delete failed for {}", key);
        }
        localRegVerifiedCache.remove(mobile);
    }

    private void storeRef(String key, String reference) {
        Duration ttl = Duration.ofSeconds(appProperties.otp().ttlSeconds());
        try {
            redisTemplate.opsForValue().set(key, reference, ttl);
        } catch (Exception e) {
            log.warn("Redis store failed, using in-memory fallback for key {}", key);
        }
        localOtpCache.put(key, new ExpiringValue(reference, Instant.now().plus(ttl)));
    }

    private String getRef(String key) {
        try {
            String val = redisTemplate.opsForValue().get(key);
            if (val != null) return val;
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
            redisTemplate.delete(key);
        } catch (Exception e) {
            log.warn("Redis delete failed for key {}", key);
        }
        localOtpCache.remove(key);
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

