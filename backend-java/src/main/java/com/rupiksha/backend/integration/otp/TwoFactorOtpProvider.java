package com.rupiksha.backend.integration.otp;

import com.rupiksha.backend.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class TwoFactorOtpProvider implements OtpProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;

    @org.springframework.beans.factory.annotation.Value("${twofactor.api-key:}")
    private String envTwoFactorApiKey;

    @Override
    public String providerName() {
        return "2factor";
    }

    private String getApiKey() {
        if (envTwoFactorApiKey != null && !envTwoFactorApiKey.isBlank()) {
            return envTwoFactorApiKey.trim();
        }
        if (appProperties.providers() != null && appProperties.providers().otp() != null) {
            return appProperties.providers().otp().apiKey();
        }
        return null;
    }

    @Override
    public String sendOtp(String mobile) {
        String apiKey = getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("2Factor API key not configured");
        }

        RestTemplate rt = restTemplateBuilder.build();
        String url = "https://2factor.in/API/V1/" + apiKey + "/SMS/" + mobile + "/AUTOGEN";
        ResponseEntity<Map> response = rt.getForEntity(url, Map.class);
        Map body = response.getBody();
        if (body == null || !"Success".equalsIgnoreCase(String.valueOf(body.get("Status")))) {
            throw new IllegalArgumentException("2Factor OTP send failed");
        }
        String details = String.valueOf(body.get("Details"));
        log.info("2Factor OTP session created for {}", mobile);
        return details;
    }

    @Override
    public boolean verifyOtp(String mobile, String otp, String reference) {
        String apiKey = getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("2Factor API key not configured");
        }
        if (reference == null || reference.isBlank()) return false;
        RestTemplate rt = restTemplateBuilder.build();

        // 1. Try standard VERIFY endpoint (for AUTOGEN OTP sessions)
        try {
            String url = "https://2factor.in/API/V1/" + apiKey + "/SMS/VERIFY/" + reference.trim() + "/" + otp.trim();
            ResponseEntity<Map> response = rt.getForEntity(url, Map.class);
            Map body = response.getBody();
            if (body != null && "Success".equalsIgnoreCase(String.valueOf(body.get("Status")))) {
                log.info("2Factor OTP verified successfully via VERIFY endpoint for {}", mobile);
                return true;
            }
        } catch (Exception e) {
            log.warn("2Factor VERIFY endpoint failed for mobile {}: {}", mobile, e.getMessage());
        }

        // 2. Fallback to VERIFY3 endpoint (for custom/transactional OTP sessions)
        try {
            String url3 = "https://2factor.in/API/V1/" + apiKey + "/SMS/VERIFY3/" + reference.trim() + "/" + otp.trim();
            ResponseEntity<Map> response3 = rt.getForEntity(url3, Map.class);
            Map body3 = response3.getBody();
            if (body3 != null && "Success".equalsIgnoreCase(String.valueOf(body3.get("Status")))) {
                log.info("2Factor OTP verified successfully via VERIFY3 endpoint for {}", mobile);
                return true;
            }
        } catch (Exception e) {
            log.warn("2Factor VERIFY3 endpoint failed for mobile {}: {}", mobile, e.getMessage());
        }

        return false;
    }
}

