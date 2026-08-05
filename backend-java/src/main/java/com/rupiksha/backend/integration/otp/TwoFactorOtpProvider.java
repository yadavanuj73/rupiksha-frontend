package com.rupiksha.backend.integration.otp;

import com.rupiksha.backend.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class TwoFactorOtpProvider implements OtpProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;

    @Value("${twofactor.api-key:${app.providers.otp.api-key:}}")
    private String envTwoFactorApiKey;

    @Value("${twofactor.sender-id:${app.providers.otp.sender-id:RPRNL}}")
    private String envSenderId;

    @Value("${twofactor.template-name:${app.providers.otp.template-name:}}")
    private String envTemplateName;

    @Value("${twofactor.peid:${app.providers.otp.peid:}}")
    private String envPeid;

    @Value("${twofactor.ctid:${app.providers.otp.ctid:}}")
    private String envCtid;

    private static final SecureRandom RANDOM = new SecureRandom();

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
            log.error("2Factor API Key is missing or unconfigured.");
            throw new IllegalArgumentException("2Factor API key not configured");
        }

        String cleanMobile = mobile != null ? mobile.replaceAll("[^0-9]", "") : "";
        if (cleanMobile.length() > 10) {
            cleanMobile = cleanMobile.substring(cleanMobile.length() - 10);
        }

        RestTemplate rt = restTemplateBuilder.build();

        // Mode 1: Transactional SMS (API R1) - Used when PEID and CTID are configured for DLT compliance
        if (envPeid != null && !envPeid.isBlank() && envCtid != null && !envCtid.isBlank()) {
            try {
                String generatedOtp = String.format("%06d", RANDOM.nextInt(1000000));
                String message = "Your OTP for Rupiksha verification is " + generatedOtp + ". Do not share it with anyone.";
                String encodedMsg = URLEncoder.encode(message, StandardCharsets.UTF_8);
                String from = (envSenderId != null && !envSenderId.isBlank()) ? envSenderId.trim() : "RPRNL";
                
                String r1Url = String.format(
                    "https://2factor.in/API/R1/?module=TRANS_SMS&apikey=%s&to=%s&from=%s&msg=%s&peid=%s&ctid=%s",
                    apiKey.trim(), cleanMobile, from, encodedMsg, envPeid.trim(), envCtid.trim()
                );
                
                log.info("Sending 2Factor Transactional OTP SMS to mobile {} via R1 API", cleanMobile);
                ResponseEntity<Map> response = rt.getForEntity(r1Url, Map.class);
                Map body = response.getBody();
                log.info("2Factor R1 API response: {}", body);
                
                if (body != null && ("Success".equalsIgnoreCase(String.valueOf(body.get("Status"))) || "Submitted".equalsIgnoreCase(String.valueOf(body.get("Status"))))) {
                    return generatedOtp;
                }
            } catch (Exception e) {
                log.warn("2Factor R1 Transactional API send failed for {}: {}. Falling back to V1 AUTOGEN", cleanMobile, e.getMessage());
            }
        }

        // Mode 2: V1 AUTOGEN with DLT Template Name
        if (envTemplateName != null && !envTemplateName.isBlank()) {
            try {
                String urlWithTemplate = "https://2factor.in/API/V1/" + apiKey.trim() + "/SMS/" + cleanMobile + "/AUTOGEN/" + envTemplateName.trim();
                log.info("Sending 2Factor OTP SMS to mobile {} with template {}", cleanMobile, envTemplateName);
                ResponseEntity<Map> response = rt.getForEntity(urlWithTemplate, Map.class);
                Map body = response.getBody();
                log.info("2Factor Template API response: {}", body);
                if (body != null && "Success".equalsIgnoreCase(String.valueOf(body.get("Status")))) {
                    return String.valueOf(body.get("Details"));
                }
            } catch (Exception e) {
                log.warn("2Factor V1 Template endpoint failed for {}: {}. Falling back to default AUTOGEN", cleanMobile, e.getMessage());
            }
        }

        // Mode 3: Standard V1 AUTOGEN Endpoint
        try {
            String url = "https://2factor.in/API/V1/" + apiKey.trim() + "/SMS/" + cleanMobile + "/AUTOGEN";
            log.info("Sending 2Factor OTP SMS to mobile {} via standard AUTOGEN", cleanMobile);
            ResponseEntity<Map> response = rt.getForEntity(url, Map.class);
            Map body = response.getBody();
            log.info("2Factor Standard AUTOGEN response: {}", body);
            
            if (body == null || !"Success".equalsIgnoreCase(String.valueOf(body.get("Status")))) {
                String details = body != null ? String.valueOf(body.get("Details")) : "No response from 2Factor";
                log.error("2Factor OTP send failed for mobile {}: Details={}", cleanMobile, details);
                throw new IllegalArgumentException("2Factor OTP send failed: " + details);
            }
            
            String details = String.valueOf(body.get("Details"));
            log.info("2Factor OTP session created successfully for mobile {}, session ref: {}", cleanMobile, details);
            return details;
        } catch (Exception e) {
            log.error("2Factor OTP send exception for mobile {}: {}", cleanMobile, e.getMessage(), e);
            throw new IllegalArgumentException("Failed to send OTP via 2Factor: " + e.getMessage());
        }
    }

    @Override
    public boolean verifyOtp(String mobile, String otp, String reference) {
        String apiKey = getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("2Factor API key not configured");
        }
        if (reference == null || reference.isBlank()) return false;

        String trimmedOtp = otp != null ? otp.trim() : "";
        String trimmedRef = reference.trim();

        // 1. Direct match for custom generated OTP (Mode 1 R1 API)
        if (trimmedRef.equals(trimmedOtp)) {
            log.info("2Factor OTP verified successfully via direct match for mobile {}", mobile);
            return true;
        }

        RestTemplate rt = restTemplateBuilder.build();

        // 2. Try standard VERIFY endpoint (for AUTOGEN OTP sessions)
        try {
            String url = "https://2factor.in/API/V1/" + apiKey.trim() + "/SMS/VERIFY/" + trimmedRef + "/" + trimmedOtp;
            ResponseEntity<Map> response = rt.getForEntity(url, Map.class);
            Map body = response.getBody();
            if (body != null && "Success".equalsIgnoreCase(String.valueOf(body.get("Status")))) {
                log.info("2Factor OTP verified successfully via VERIFY endpoint for {}", mobile);
                return true;
            }
        } catch (Exception e) {
            log.warn("2Factor VERIFY endpoint failed for mobile {}: {}", mobile, e.getMessage());
        }

        // 3. Fallback to VERIFY3 endpoint (for custom/transactional OTP sessions)
        try {
            String url3 = "https://2factor.in/API/V1/" + apiKey.trim() + "/SMS/VERIFY3/" + trimmedRef + "/" + trimmedOtp;
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
