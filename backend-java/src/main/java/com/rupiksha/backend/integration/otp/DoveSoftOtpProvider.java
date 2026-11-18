package com.rupiksha.backend.integration.otp;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class DoveSoftOtpProvider implements OtpProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${dovesoft.api-key:${DOVESOFT_API_KEY:${OTP_API_KEY:}}}")
    private String envApiKey;

    @Value("${dovesoft.base-url:${DOVESOFT_BASE_URL:${OTP_BASE_URL:https://api.dovesoft.io}}}")
    private String envBaseUrl;

    @Value("${dovesoft.entity-id:${DOVESOFT_ENTITY_ID:${OTP_ENTITY_ID:${TWOFACTOR_PEID:${OTP_PEID:1701176347102771967}}}}}")
    private String envEntityId;

    @Value("${dovesoft.temp-id:${DOVESOFT_TEMP_ID:${OTP_TEMP_ID:${TWOFACTOR_CTID:${OTP_CTID:1707176432251139080}}}}}")
    private String envTempId;

    @Value("${dovesoft.sender-id:${DOVESOFT_SENDER_ID:${OTP_SENDER_ID:${TWOFACTOR_SENDER_ID:RUPIKS}}}}")
    private String envSenderId;

    @Value("${dovesoft.timetoalive:${DOVESOFT_TTL:${OTP_TTL_SECONDS:200}}}")
    private int envTimeToAlive;

    public static final String DEFAULT_MESSAGE_TEMPLATE =
            "Dear Partner, Your OTP for login is {otp}. Do not share with anyone. visit us at https://rupiksha.com\n -Rupiksha Services";

    @Value("${dovesoft.message:${DOVESOFT_OTP_MESSAGE:${OTP_MESSAGE:}}}")
    private String envMessage;

    private volatile String cachedDiscoveredTemplate = null;
    private volatile String cachedDiscoveredTempId = null;
    private volatile String cachedDiscoveredSenderId = null;
    private volatile String cachedDiscoveredEntityId = null;
    private volatile long cacheExpiryTimeMs = 0L;
    private static final long CACHE_DURATION_MS = 10 * 60 * 1000L; // 10 minutes

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

    public String getEntityId() {
        if (envEntityId != null && !envEntityId.isBlank()) {
            return envEntityId.trim();
        }
        if (cachedDiscoveredEntityId != null && !cachedDiscoveredEntityId.isBlank()) {
            return cachedDiscoveredEntityId.trim();
        }
        return "";
    }

    public String getTempId() {
        if (envTempId != null && !envTempId.isBlank()) {
            return envTempId.trim();
        }
        if (cachedDiscoveredTempId != null && !cachedDiscoveredTempId.isBlank()) {
            return cachedDiscoveredTempId.trim();
        }
        return "";
    }

    public String getSenderId() {
        if (envSenderId != null && !envSenderId.isBlank()) {
            return envSenderId.trim();
        }
        if (cachedDiscoveredSenderId != null && !cachedDiscoveredSenderId.isBlank()) {
            return cachedDiscoveredSenderId.trim();
        }
        if (appProperties != null && appProperties.providers() != null && appProperties.providers().otp() != null) {
            String senderId = appProperties.providers().otp().senderId();
            if (senderId != null && !senderId.isBlank()) {
                return senderId.trim();
            }
        }
        return "";
    }

    public Map<String, Object> fetchTemplates() {
        String apiKey = getApiKey();
        if (apiKey.isBlank()) {
            return Map.of("status", "error", "message", "DoveSoft API key not configured");
        }
        String baseUrl = getBaseUrl();
        String url = baseUrl + "/api/getSmsTemplates?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.set("key", apiKey);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        headers.set(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        RestTemplate rt = restTemplateBuilder.build();
        try {
            ResponseEntity<Map> response = rt.exchange(URI.create(url), HttpMethod.POST, entity, Map.class);
            return response.getBody() != null ? response.getBody() : Map.of("status", "empty");
        } catch (Exception e) {
            log.warn("DoveSoft getSmsTemplates call failed: {}", e.getMessage());
            return Map.of("status", "error", "message", e.getMessage());
        }
    }

    public Map<String, Object> getWalletBalance() {
        String apiKey = getApiKey();
        if (apiKey.isBlank()) {
            return Map.of("status", "error", "message", "DoveSoft API key not configured");
        }
        String baseUrl = getBaseUrl();
        String url = baseUrl + "/api/getWallet";
        HttpHeaders headers = new HttpHeaders();
        headers.set("key", apiKey);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        RestTemplate rt = restTemplateBuilder.build();
        try {
            ResponseEntity<Map> response = rt.exchange(URI.create(url), HttpMethod.GET, entity, Map.class);
            return response.getBody() != null ? response.getBody() : Map.of("status", "empty");
        } catch (Exception e) {
            log.warn("DoveSoft getWallet call failed: {}", e.getMessage());
            return Map.of("status", "error", "message", e.getMessage());
        }
    }

    public synchronized void autoDiscoverTemplate() {
        long now = System.currentTimeMillis();
        if (cachedDiscoveredTemplate != null && now < cacheExpiryTimeMs) {
            return;
        }

        try {
            Map<String, Object> resp = fetchTemplates();
            if (resp != null && "success".equalsIgnoreCase(String.valueOf(resp.get("status")))) {
                Object listObj = resp.get("templateList");
                if (listObj instanceof List<?> list && !list.isEmpty()) {
                    for (Object item : list) {
                        if (item instanceof Map<?, ?> tpl) {
                            String content = tpl.get("templateContent") != null ? String.valueOf(tpl.get("templateContent")).trim() : "";
                            String name = tpl.get("templateName") != null ? String.valueOf(tpl.get("templateName")).trim() : "";
                            String lower = content.toLowerCase();
                            String nameLower = name.toLowerCase();

                            // Prioritize template containing otp or login
                            if (lower.contains("otp") || lower.contains("login") || lower.contains("password")
                                    || nameLower.contains("otp") || nameLower.contains("login")) {
                                cachedDiscoveredTemplate = normalizeTemplate(content);
                                if (tpl.get("templateId") != null && !String.valueOf(tpl.get("templateId")).isBlank()) {
                                    cachedDiscoveredTempId = String.valueOf(tpl.get("templateId")).trim();
                                }
                                if (tpl.get("senderId") != null && !String.valueOf(tpl.get("senderId")).isBlank()) {
                                    cachedDiscoveredSenderId = String.valueOf(tpl.get("senderId")).trim();
                                }
                                if (tpl.get("entityId") != null && !String.valueOf(tpl.get("entityId")).isBlank()) {
                                    cachedDiscoveredEntityId = String.valueOf(tpl.get("entityId")).trim();
                                }
                                cacheExpiryTimeMs = now + CACHE_DURATION_MS;
                                log.info("Auto-discovered active DoveSoft template: name='{}', id='{}', sender='{}', content='{}'",
                                        name, cachedDiscoveredTempId, cachedDiscoveredSenderId, cachedDiscoveredTemplate);
                                return;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Auto-discovery of DoveSoft template failed, continuing with configured defaults: {}", e.getMessage());
        }
        cacheExpiryTimeMs = now + 60_000L;
    }

    public String normalizeTemplate(String template) {
        if (template == null || template.isBlank()) {
            template = DEFAULT_MESSAGE_TEMPLATE;
        }
        // Convert literal \r\n and \n sequences (often passed via env variables / text boxes) to actual line breaks
        if (template.contains("\\n") || template.contains("\\r")) {
            template = template.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\r", "\n");
        }

        // Convert DLT placeholders ({#var#}, {#num#}, etc.) to DoveSoft generateOtp placeholder {otp}
        template = template.replace("{#var#}", "{otp}").replace("{#Var#}", "{otp}")
                           .replace("{#num#}", "{otp}").replace("{#Num#}", "{otp}");

        // If placeholder {otp} was omitted in the configured string, insert {otp} safely
        if (!template.contains("{otp}")) {
            if (template.toLowerCase().contains("login is")) {
                template = template.replaceFirst("(?i)login\\s+is\\s*", "login is {otp} ");
            } else if (template.toLowerCase().contains("otp is")) {
                template = template.replaceFirst("(?i)otp\\s+is\\s*", "OTP is {otp} ");
            } else if (template.toLowerCase().contains("password is")) {
                template = template.replaceFirst("(?i)password\\s+is\\s*", "Password is {otp} ");
            } else if (template.toLowerCase().contains("is")) {
                template = template.replaceFirst("(?i)is\\s*", "is {otp} ");
            } else {
                template = template + " {otp}";
            }
        }
        return template;
    }

    public String resolveMessageTemplate() {
        // 1. If explicit env variable is provided and non-blank, check if it's set
        if (envMessage != null && !envMessage.isBlank()) {
            return normalizeTemplate(envMessage.trim());
        }

        // 2. Try auto-discovery from DoveSoft's registered template list
        autoDiscoverTemplate();
        if (cachedDiscoveredTemplate != null && !cachedDiscoveredTemplate.isBlank()) {
            return cachedDiscoveredTemplate;
        }

        // 3. Fallback to default approved template matching DLT portal and CTA URL
        return normalizeTemplate(DEFAULT_MESSAGE_TEMPLATE);
    }

    public Map<String, Object> getDiagnostics() {
        String key = getApiKey();
        String maskedKey = key.isBlank() ? "NOT_CONFIGURED" : (key.length() > 6 ? key.substring(0, 4) + "..." + key.substring(key.length() - 2) : "***");
        return Map.of(
                "apiKeyConfigured", !key.isBlank(),
                "apiKeyMasked", maskedKey,
                "baseUrl", getBaseUrl(),
                "resolvedMessageTemplate", resolveMessageTemplate(),
                "entityId", getEntityId(),
                "tempId", getTempId(),
                "senderId", getSenderId(),
                "discoveredTemplate", cachedDiscoveredTemplate != null ? cachedDiscoveredTemplate : "NONE",
                "templatesFromDoveSoft", fetchTemplates(),
                "wallet", getWalletBalance()
        );
    }

    private String cleanMobileNumber(String mobile) {
        String cleaned = mobile != null ? mobile.replaceAll("[^0-9]", "") : "";
        if (cleaned.length() > 10) {
            cleaned = cleaned.substring(cleaned.length() - 10);
        }
        return cleaned;
    }

    public String extractErrorMessage(Map<?, ?> body) {
        if (body == null || body.isEmpty()) {
            return "Empty response from DoveSoft";
        }

        // Check response, msg, reason, message, etc.
        for (String field : List.of("response", "msg", "reason", "message", "error", "description", "desc", "details", "Details", "data", "res")) {
            Object val = body.get(field);
            if (val != null && !String.valueOf(val).isBlank() && !"null".equalsIgnoreCase(String.valueOf(val))) {
                return String.valueOf(val).trim();
            }
        }

        // If result field contains a descriptive failure reason instead of generic "fail"
        Object result = body.get("result");
        if (result != null) {
            String resStr = String.valueOf(result).trim();
            if (!resStr.isBlank() && !"fail".equalsIgnoreCase(resStr) && !"false".equalsIgnoreCase(resStr)) {
                return resStr;
            }
        }

        return body.toString();
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

        String entityId = getEntityId();
        if (entityId.isBlank()) {
            log.error("DoveSoft DLT Entity ID (PEID) is missing.");
            throw new IllegalArgumentException("DoveSoft requires a valid numeric DLT Entity ID. Please configure DOVESOFT_ENTITY_ID in environment variables.");
        }

        int ttl = envTimeToAlive > 0 ? envTimeToAlive : 200;
        String messageTemplate = resolveMessageTemplate();

        String baseUrl = getBaseUrl();
        // Standard percent-encoding (replace '+' with '%20' so spaces are never misinterpreted)
        String encodedMessage = URLEncoder.encode(messageTemplate, StandardCharsets.UTF_8).replace("+", "%20");

        StringBuilder urlBuilder = new StringBuilder(baseUrl)
                .append("/rest/generateOtp")
                .append("?mobileno=").append(cleanMobile)
                .append("&timetoalive=").append(ttl)
                .append("&message=").append(encodedMessage)
                .append("&entityid=").append(URLEncoder.encode(entityId, StandardCharsets.UTF_8));

        String tempId = getTempId();
        if (!tempId.isBlank()) {
            urlBuilder.append("&tempid=").append(URLEncoder.encode(tempId, StandardCharsets.UTF_8));
            urlBuilder.append("&templateid=").append(URLEncoder.encode(tempId, StandardCharsets.UTF_8));
        }

        String senderId = getSenderId();
        if (!senderId.isBlank()) {
            urlBuilder.append("&senderid=").append(URLEncoder.encode(senderId, StandardCharsets.UTF_8));
        }

        String url = urlBuilder.toString();
        URI uri = URI.create(url);

        log.info("Sending OTP via DoveSoft for mobile {} (endpoint: {}/rest/generateOtp, entityid: {}, tempid: {}, senderid: {}, message: {})",
                cleanMobile, baseUrl, entityId, tempId, senderId, messageTemplate);

        HttpHeaders headers = new HttpHeaders();
        headers.set("key", apiKey);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        RestTemplate rt = restTemplateBuilder.build();
        try {
            ResponseEntity<Map> response = rt.exchange(uri, HttpMethod.POST, entity, Map.class);
            Map body = response.getBody();
            log.info("DoveSoft generateOtp response for {}: {}", cleanMobile, body);

            if (body == null) {
                throw new IllegalArgumentException("No response received from DoveSoft OTP service");
            }

            String result = body.get("result") != null ? String.valueOf(body.get("result")).trim() : "";
            String status = body.get("status") != null ? String.valueOf(body.get("status")).trim() : "";
            boolean isSuccess = "success".equalsIgnoreCase(result) || "success".equalsIgnoreCase(status);

            if (!isSuccess) {
                String reason = extractErrorMessage(body);
                log.error("DoveSoft OTP generate failed for mobile {}: reason={}, fullBody={}", cleanMobile, reason, body);
                throw new IllegalArgumentException("DoveSoft OTP send failed: " + reason);
            }

            Object otpIdObj = body.get("otpId") != null ? body.get("otpId") : body.get("otpid");
            String ref = otpIdObj != null ? String.valueOf(otpIdObj).trim() : "";
            if (ref.isBlank() || "-1".equals(ref)) {
                ref = "success";
            }

            log.info("DoveSoft OTP session created successfully for mobile {}, session ref: {}", cleanMobile, ref);
            return ref;
        } catch (HttpStatusCodeException e) {
            String responseBody = e.getResponseBodyAsString();
            log.error("DoveSoft HTTP error for mobile {}: status={}, body={}", cleanMobile, e.getStatusCode(), responseBody);
            String errDetail = responseBody;
            try {
                Map<?, ?> errMap = objectMapper.readValue(responseBody, Map.class);
                errDetail = extractErrorMessage(errMap);
            } catch (Exception ignored) {
            }
            throw new IllegalArgumentException("DoveSoft OTP send failed: " + errDetail);
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
            ResponseEntity<Map> response = rt.exchange(URI.create(validateUrl), HttpMethod.POST, entity, Map.class);
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
                ResponseEntity<Map> fbResponse = rt.exchange(URI.create(fallbackUrl), HttpMethod.POST, entity, Map.class);
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
