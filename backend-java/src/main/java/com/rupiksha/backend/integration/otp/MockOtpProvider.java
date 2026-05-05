package com.rupiksha.backend.integration.otp;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@Primary
public class MockOtpProvider implements OtpProvider {
    private final SecureRandom random = new SecureRandom();
    private final Map<String, String> store = new ConcurrentHashMap<>();

    @Override
    public String providerName() {
        return "mock";
    }

    @Override
    public String sendOtp(String mobile) {
        String code = String.valueOf(100000 + random.nextInt(900000));
        store.put(mobile, code);
        log.info("[MOCK OTP] mobile={} code={}", mobile, code);
        return mobile;
    }

    @Override
    public boolean verifyOtp(String mobile, String otp, String reference) {
        return otp != null && otp.equals(store.get(mobile));
    }
}

