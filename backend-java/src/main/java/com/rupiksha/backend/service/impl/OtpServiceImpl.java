package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.OtpDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.service.OtpService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class OtpServiceImpl implements OtpService {
    private final StringRedisTemplate redisTemplate;
    private final OtpProviderRouter otpProviderRouter;
    private final AppProperties appProperties;
    private final Map<String, String> localOtpCache = new ConcurrentHashMap<>();

    @Override
    public OtpDtos.OtpResponse sendOtp(OtpDtos.SendOtpRequest request) {
        var provider = otpProviderRouter.current();
        String key = "otp:ref:" + request.mobile();
        String reference = provider.sendOtp(request.mobile());
        storeRef(key, reference);
        return new OtpDtos.OtpResponse(true, "OTP sent successfully");
    }

    @Override
    public OtpDtos.OtpResponse verifyOtp(OtpDtos.VerifyOtpRequest request) {
        var provider = otpProviderRouter.current();
        String key = "otp:ref:" + request.mobile();
        String reference = getRef(key);
        if (reference == null || reference.isBlank()) {
            // For mock provider or direct dev testing, fallback check
            if ("mock".equalsIgnoreCase(provider.providerName()) && "123456".equals(request.otp())) {
                return new OtpDtos.OtpResponse(true, "OTP verified successfully");
            }
            return new OtpDtos.OtpResponse(false, "OTP expired or invalid session");
        }
        boolean ok = provider.verifyOtp(request.mobile(), request.otp(), reference);
        if (!ok) return new OtpDtos.OtpResponse(false, "Invalid OTP");
        removeRef(key);
        return new OtpDtos.OtpResponse(true, "OTP verified successfully");
    }

    @Override
    public OtpDtos.OtpResponse resendOtp(OtpDtos.SendOtpRequest request) {
        return sendOtp(request);
    }

    private void storeRef(String key, String reference) {
        try {
            redisTemplate.opsForValue().set(key, reference, Duration.ofSeconds(appProperties.otp().ttlSeconds()));
        } catch (Exception e) {
            log.warn("Redis store failed, using in-memory fallback for key {}", key);
            localOtpCache.put(key, reference);
        }
    }

    private String getRef(String key) {
        try {
            String val = redisTemplate.opsForValue().get(key);
            if (val != null) return val;
        } catch (Exception e) {
            log.warn("Redis read failed, using in-memory fallback for key {}", key);
        }
        return localOtpCache.get(key);
    }

    private void removeRef(String key) {
        try {
            redisTemplate.delete(key);
        } catch (Exception e) {
            log.warn("Redis delete failed for key {}", key);
        }
        localOtpCache.remove(key);
    }
}
