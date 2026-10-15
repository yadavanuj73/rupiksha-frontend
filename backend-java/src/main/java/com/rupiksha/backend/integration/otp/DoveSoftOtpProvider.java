package com.rupiksha.backend.integration.otp;

import com.rupiksha.backend.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class DoveSoftOtpProvider implements OtpProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;

    @Value("${dovesoft.api-key:${DOVESOFT_API_KEY:${OTP_API_KEY:}}}")
    private String envApiKey;

    @Value("${dovesoft.base-url:${DOVESOFT_BASE_URL:${OTP_BASE_URL:https://api.dovesoft.io}}}")
    private String envBaseUrl;

    @Value("${dovesoft.timetoalive:${DOVESOFT_TTL:${OTP_TTL_SECONDS:200}}}")
    private int envTimeToAlive;

    public static final String DEFAULT_MESSAGE_TEMPLATE =
            "Dear User Your One Tine Password is {otp}\n\nThanks You.\nRupiksha Services Private Limeted";

    @Value("${dovesoft.message:${DOVESOFT_OTP_MESSAGE:${OTP_MESSAGE:}}}")
    private String envMessage;

    @Override
    public String providerName() {
        return "dovesoft";
    }

    private String getApiKey() {
        if (envApiKey != null && !envApiKey.isBlank()) {
            return envApiKey.trim();
        }
        if (appProperties != null && appProperties.providers() != null && appProperties.providers().otp() != null) {
            String propKey = appProperties.providers().otp().apiKey();
            if (propKey != null && !propKey.isBlank()) {
                return propKey.trim();
            }
        }
        return "";
    }

    private String getBaseUrl() {
        String url = envBaseUrl;
        if (url == null || url.isBlank()) {
            if (appProperties != null && appProperties.providers() != null && appProperties.providers().otp() != null) {
                url = appProperties.providers().otp().baseUrl();
            }
        }
        if (url == null || url.isBlank()) {
            url = "https://api.dovesoft.io";
        }
        url = url.trim();
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }

    public String resolveMessageTemplate() {
        String template = (envMessage != null && !envMessage.isBlank())
                ? envMessage.trim()
                : DEFAULT_MESSAGE_TEMPLATE;
        // If placeholder {otp} or {#var#} was omitted in the configured string, insert {otp} safely
        if (!template.contains("{otp}") && !template.contains("{#var#}") && !template.contains("{#Var#}")) {
            if (template.toLowerCase().contains("password is")) {
                template = template.replaceFirst("(?i)password\\s+is\\s*", "Password is {otp} ");
            } else if (template.toLowerCase().contains("is")) {
                template = template.replaceFirst("(?i)is\\s*", "is {otp} ");
            } else {
                template = template + " {otp}";
            }
        }
        return template;
    }

    private String cleanMobileNumber(String mobile) {
        String cleaned = mobile != null ? mobile.replaceAll("[^0-9]", "") : "";
        if (cleaned.length() > 10) {
            cleaned = cleaned.substring(cleaned.length() - 10);
        }
        return cleaned;
    }

    @Override
    public String sendOtp(String mobile) {
        String apiKey = getApiKey();
        if (apiKey.isBlank()) {
            log.error("DoveSoft API Key is missing or unconfigured.");
            throw new IllegalArgumentException("DoveSoft OTP API key not configured");
        }

        String cleanMobile = cleanMobileNumber(mobile);
        if (cleanMobile.length() != 10) {
            log.error("Invalid mobile number provided for DoveSoft OTP send: {}", mobile);
            throw new IllegalArgumentException("Invalid mobile number. Exactly 10 digits required.");
        }

        int ttl = envTimeToAlive > 0 ? envTimeToAlive : 200;
        String messageTemplate = resolveMessageTemplate();

        String baseUrl = getBaseUrl();
        String encodedMessage = URLEncoder.encode(messageTemplate, StandardCharsets.UTF_8);
        String url = String.format("%s/rest/generateOtp?mobileno=%s&timetoalive=%d&message=%s",
                baseUrl, cleanMobile, ttl, encodedMessage);

        log.info("Sending OTP via DoveSoft for mobile {} (endpoint: {}/rest/generateOtp, ttl: {}s)",
                cleanMobile, baseUrl, ttl);

        HttpHeaders headers = new HttpHeaders();
        headers.set("key", apiKey);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        RestTemplate rt = restTemplateBuilder.build();
        try {
            ResponseEntity<Map> response = rt.exchange(url, HttpMethod.POST, entity, Map.class);
            Map body = response.getBody();
            log.info("DoveSoft generateOtp response for {}: {}", cleanMobile, body);

            if (body == null) {
                throw new IllegalArgumentException("No response received from DoveSoft OTP service");
            }

            String result = body.get("result") != null ? String.valueOf(body.get("result")).trim() : "";
            String status = body.get("status") != null ? String.valueOf(body.get("status")).trim() : "";
            boolean isSuccess = "success".equalsIgnoreCase(result) || "success".equalsIgnoreCase(status);

            if (!isSuccess) {
                String reason = body.get("reason") != null ? String.valueOf(body.get("reason"))
                        : (body.get("message") != null ? String.valueOf(body.get("message")) : "Unknown error");
                log.error("DoveSoft OTP generate failed for mobile {}: {}", cleanMobile, reason);
                throw new IllegalArgumentException("DoveSoft OTP send failed: " + reason);
            }

            Object otpIdObj = body.get("otpId") != null ? body.get("otpId") : body.get("otpid");
            String ref = otpIdObj != null ? String.valueOf(otpIdObj).trim() : "";
            if (ref.isBlank() || "-1".equals(ref)) {
                ref = "success";
            }

            log.info("DoveSoft OTP session created successfully for mobile {}, session ref: {}", cleanMobile, ref);
            return ref;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("DoveSoft OTP send exception for mobile {}: {}", cleanMobile, e.getMessage(), e);
            throw new IllegalArgumentException("Failed to send OTP via DoveSoft: " + e.getMessage());
        }
    }

    @Override
    public boolean verifyOtp(String mobile, String otp, String reference) {
        if (otp == null || otp.isBlank()) {
            return false;
        }

        String apiKey = getApiKey();
        if (apiKey.isBlank()) {
            log.error("DoveSoft API Key not configured during OTP verification");
            throw new IllegalArgumentException("DoveSoft OTP API key not configured");
        }

        String cleanMobile = cleanMobileNumber(mobile);
        if (cleanMobile.length() != 10) {
            log.warn("Invalid mobile length for DoveSoft verifyOtp: {}", mobile);
            return false;
        }

        String trimmedOtp = otp.trim();
        String baseUrl = getBaseUrl();
        String encodedOtp = URLEncoder.encode(trimmedOtp, StandardCharsets.UTF_8);

        boolean hasOtpid = reference != null && !reference.isBlank()
                && !"success".equalsIgnoreCase(reference) && !"-1".equals(reference);

        String validateUrl = String.format("%s/rest/validateOtpApi?mobileno=%s&otp=%s", baseUrl, cleanMobile, encodedOtp);
        if (hasOtpid) {
            validateUrl += "&otpid=" + URLEncoder.encode(reference.trim(), StandardCharsets.UTF_8);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("key", apiKey);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        RestTemplate rt = restTemplateBuilder.build();

        // 1. Primary validation attempt (including otpid if available)
        try {
            log.info("Validating OTP via DoveSoft for mobile {} (hasOtpid: {})", cleanMobile, hasOtpid);
            ResponseEntity<Map> response = rt.exchange(validateUrl, HttpMethod.POST, entity, Map.class);
            Map body = response.getBody();
            log.info("DoveSoft validateOtpApi response for {}: {}", cleanMobile, body);

            if (isVerificationSuccessful(body)) {
                log.info("DoveSoft OTP verified successfully for mobile {}", cleanMobile);
                return true;
            }
        } catch (Exception e) {
            log.warn("DoveSoft validateOtpApi call failed for mobile {}: {}", cleanMobile, e.getMessage());
        }

        // 2. Resilient fallback: If validation with otpid failed, retry without otpid parameter
        if (hasOtpid) {
            try {
                String fallbackUrl = String.format("%s/rest/validateOtpApi?mobileno=%s&otp=%s", baseUrl, cleanMobile, encodedOtp);
                log.info("Retrying DoveSoft OTP validation without otpid for mobile {}", cleanMobile);
                ResponseEntity<Map> fbResponse = rt.exchange(fallbackUrl, HttpMethod.POST, entity, Map.class);
                Map fbBody = fbResponse.getBody();
                log.info("DoveSoft validateOtpApi fallback response for {}: {}", cleanMobile, fbBody);

                if (isVerificationSuccessful(fbBody)) {
                    log.info("DoveSoft OTP verified successfully via fallback for mobile {}", cleanMobile);
                    return true;
                }
            } catch (Exception e) {
                log.warn("DoveSoft validateOtpApi fallback call failed for mobile {}: {}", cleanMobile, e.getMessage());
            }
        }

        log.warn("DoveSoft OTP verification failed for mobile {}", cleanMobile);
        return false;
    }

    private boolean isVerificationSuccessful(Map body) {
        if (body == null) return false;
        String result = body.get("result") != null ? String.valueOf(body.get("result")).trim() : "";
        String status = body.get("status") != null ? String.valueOf(body.get("status")).trim() : "";
        return "success".equalsIgnoreCase(result) || "success".equalsIgnoreCase(status);
    }
}
