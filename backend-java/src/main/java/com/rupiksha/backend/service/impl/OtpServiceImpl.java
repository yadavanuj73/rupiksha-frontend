package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.OtpDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.service.OtpService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class OtpServiceImpl implements OtpService {
    private final StringRedisTemplate redisTemplate;
    private final OtpProviderRouter otpProviderRouter;
    private final AppProperties appProperties;

    @Override
    public OtpDtos.OtpResponse sendOtp(OtpDtos.SendOtpRequest request) {
        var provider = otpProviderRouter.current();
        String key = "otp:ref:" + request.mobile();
        String reference = provider.sendOtp(request.mobile());
        redisTemplate.opsForValue().set(key, reference, Duration.ofSeconds(appProperties.otp().ttlSeconds()));
        return new OtpDtos.OtpResponse(true, "OTP sent");
    }

    @Override
    public OtpDtos.OtpResponse verifyOtp(OtpDtos.VerifyOtpRequest request) {
        var provider = otpProviderRouter.current();
        String key = "otp:ref:" + request.mobile();
        String reference = redisTemplate.opsForValue().get(key);
        if (reference == null || reference.isBlank()) {
            return new OtpDtos.OtpResponse(false, "Invalid OTP");
        }
        boolean ok = provider.verifyOtp(request.mobile(), request.otp(), reference);
        if (!ok) return new OtpDtos.OtpResponse(false, "Invalid OTP");
        redisTemplate.delete(key);
        return new OtpDtos.OtpResponse(true, "OTP verified");
    }
}

