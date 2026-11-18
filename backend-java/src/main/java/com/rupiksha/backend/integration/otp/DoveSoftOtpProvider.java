package com.rupiksha.backend.integration.otp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.service.SmsDeliveryService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
public class DoveSoftOtpProvider implements OtpProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;
    private final SmsDeliveryService smsDeliveryService;
    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom = new SecureRandom();

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
            "Dear Partner, Your OTP is {otp}.\nDo not share with anyone.\nvisit us at www.rupiksha.com\n<RUPIKSHA>";

    @Value("${dovesoft.message:${DOVESOFT_OTP_MESSAGE:${OTP_MESSAGE:}}}")
    private String envMessage;

    @Value("${dovesoft.use-json-api:${DOVESOFT_USE_JSON_API:true}}")
    private boolean envUseJsonApi = true;

    @Value("${dovesoft.callback-token:${DOVESOFT_CALLBACK_TOKEN:}}")
    private String envCallbackToken;

    @Autowired
    public DoveSoftOtpProvider(
            AppProperties appProperties,
            RestTemplateBuilder restTemplateBuilder,
            @Autowired(required = false) SmsDeliveryService smsDeliveryService,
            @Autowired(required = false) ObjectMapper objectMapper
    ) {
        this.appProperties = appProperties;
        this.restTemplateBuilder = restTemplateBuilder;
        this.smsDeliveryService = smsDeliveryService;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    // Convenience constructor for unit testing
    public DoveSoftOtpProvider(AppProperties appProperties, RestTemplateBuilder restTemplateBuilder) {
        this(appProperties, restTemplateBuilder, null, null);
    }

    public boolean isUseJsonApi() {
        return envUseJsonApi;
    }

    @Override
    public String providerName() {
        return "dovesoft";
    }

    public String getApiKey() {
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

    public String getBaseUrl() {
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
        return "";
    }

    public String getTempId() {
        if (envTempId != null && !envTempId.isBlank()) {
            return envTempId.trim();
        }
        return "";
    }

    public String getSenderId() {
        if (envSenderId != null && !envSenderId.isBlank()) {
            return envSenderId.trim();
        }
        if (appProperties != null && appProperties.providers() != null && appProperties.providers().otp() != null) {
            String senderId = appProperties.providers().otp().senderId();
            if (senderId != null && !senderId.isBlank()) {
                return senderId.trim();
            }
        }
        return "";
    }

    public String resolveMessageTemplate() {
        String template = (envMessage != null && !envMessage.isBlank())
                ? envMessage.trim()
                : DEFAULT_MESSAGE_TEMPLATE;

        // Convert literal \r\n and \n sequences to actual line breaks
        if (template.contains("\\n") || template.contains("\\r")) {
            template = template.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\r", "\n");
        }

        // Convert DLT placeholder {#var#} or {#num#} to DoveSoft placeholder {otp}
        template = template.replace("{#var#}", "{otp}")
                .replace("{#Var#}", "{otp}")
                .replace("{#num#}", "{otp}");

        // If placeholder {otp} was omitted in the configured string, insert {otp} safely
        if (!template.contains("{otp}")) {
            if (template.toLowerCase().contains("otp is")) {
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

    public String formatMessageWithOtp(String otpCode) {
        String rawTemplate = resolveMessageTemplate();
        return rawTemplate.replace("{otp}", otpCode);
    }

    public String cleanMobileNumber(String mobile) {
        String cleaned = mobile != null ? mobile.replaceAll("[^0-9]", "") : "";
        if (cleaned.length() > 10) {
            cleaned = cleaned.substring(cleaned.length() - 10);
        }
        return cleaned;
    }

    /**
     * Sends OTP SMS using DoveSoft official JSON Send SMS API (POST /api/json/sendsms/).
     * This avoids RestTemplate double-encoding and guarantees exact DLT CTA URL and template matching.
     */
    public String sendJsonSms(String mobile, String otpCode, String clientSmsId) {
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
            throw new IllegalArgumentException("DoveSoft requires a valid numeric DLT Entity ID.");
        }

        String tempId = getTempId();
        String senderId = getSenderId();
        String message = formatMessageWithOtp(otpCode);
        String formattedMobile = "+91" + cleanMobile;

        // Construct JSON Send SMS request payload
        Map<String, Object> smsItem = new HashMap<>();
        smsItem.put("sms", message);
        smsItem.put("mobiles", formattedMobile);
        smsItem.put("senderid", senderId);
        smsItem.put("entityid", entityId);
        smsItem.put("tempid", tempId);

        Map<String, Object> requestPayload = Map.of("listsms", List.of(smsItem));

        String baseUrl = getBaseUrl();
        String endpoint = baseUrl + "/api/json/sendsms/";

        log.info("Dispatching SMS via DoveSoft JSON API to mobile: {} (senderId: {}, entityId: {}, tempId: {})",
                cleanMobile, senderId, entityId, tempId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("key", apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestPayload, headers);

        RestTemplate rt = restTemplateBuilder.build();
        try {
            ResponseEntity<Map> response = rt.exchange(endpoint, HttpMethod.POST, entity, Map.class);
            Map body = response.getBody();
            log.info("DoveSoft JSON sendsms response for {}: {}", cleanMobile, body);

            if (body == null) {
                throw new IllegalArgumentException("No response received from DoveSoft JSON Send SMS service");
            }

            // Inspect response for success
            String status = body.get("status") != null ? String.valueOf(body.get("status")).trim() : "";
            String result = body.get("result") != null ? String.valueOf(body.get("result")).trim() : "";
            boolean isSuccess = "success".equalsIgnoreCase(status)
                    || "success".equalsIgnoreCase(result)
                    || "ok".equalsIgnoreCase(status)
                    || "accepted".equalsIgnoreCase(status);

            String providerMessageId = null;

            // Check DoveSoft official response structure: body.get("smslist")
            Object smslistObj = body.get("smslist");
            if (smslistObj instanceof Map<?, ?> smslistMap) {
                Object smsObj = smslistMap.get("sms");
                if (smsObj instanceof Map<?, ?> itemMap) {
                    Object itemStatus = itemMap.get("status");
                    Object itemReason = itemMap.get("reason");
                    Object itemCode = itemMap.get("code");
                    if ("success".equalsIgnoreCase(String.valueOf(itemStatus))
                            || "success".equalsIgnoreCase(String.valueOf(itemReason))
                            || "000".equals(String.valueOf(itemCode))) {
                        isSuccess = true;
                    }
                    Object msgIdObj = itemMap.get("messageid");
                    if (msgIdObj == null) msgIdObj = itemMap.get("msgid");
                    if (msgIdObj != null) {
                        providerMessageId = String.valueOf(msgIdObj).trim();
                    }
                } else if (smsObj instanceof List<?> itemList && !itemList.isEmpty()) {
                    Object first = itemList.get(0);
                    if (first instanceof Map<?, ?> itemMap) {
                        Object itemStatus = itemMap.get("status");
                        Object itemReason = itemMap.get("reason");
                        Object itemCode = itemMap.get("code");
                        if ("success".equalsIgnoreCase(String.valueOf(itemStatus))
                                || "success".equalsIgnoreCase(String.valueOf(itemReason))
                                || "000".equals(String.valueOf(itemCode))) {
                            isSuccess = true;
                        }
                        Object msgIdObj = itemMap.get("messageid");
                        if (msgIdObj == null) msgIdObj = itemMap.get("msgid");
                        if (msgIdObj != null) {
                            providerMessageId = String.valueOf(msgIdObj).trim();
                        }
                    }
                }
            }

            // Check if listsms data items indicate success
            Object dataObj = body.get("data");
            if (dataObj instanceof List<?> dataList && !dataList.isEmpty()) {
                Object firstItem = dataList.get(0);
                if (firstItem instanceof Map<?, ?> itemMap) {
                    Object itemStatus = itemMap.get("status");
                    if (itemStatus != null && "success".equalsIgnoreCase(String.valueOf(itemStatus).trim())) {
                        isSuccess = true;
                    }
                    Object msgIdObj = itemMap.get("messageid");
                    if (msgIdObj == null) msgIdObj = itemMap.get("msgid");
                    if (msgIdObj != null) {
                        providerMessageId = String.valueOf(msgIdObj).trim();
                    }
                }
            }

            if (providerMessageId == null) {
                Object msgIdObj = body.get("messageid") != null ? body.get("messageid") : body.get("msgid");
                if (msgIdObj != null) {
                    providerMessageId = String.valueOf(msgIdObj).trim();
                } else {
                    providerMessageId = clientSmsId;
                }
            }

            if (!isSuccess) {
                String reason = extractErrorMessage(body);
                log.error("DoveSoft JSON Send SMS failed for mobile {}: reason={}, body={}", cleanMobile, reason, body);
                if (smsDeliveryService != null) {
                    smsDeliveryService.recordOutboundSms(clientSmsId, providerMessageId, cleanMobile, senderId, "FAILED", String.valueOf(body));
                }
                throw new IllegalArgumentException("DoveSoft SMS send failed: " + reason);
            }

            log.info("DoveSoft JSON SMS delivered to provider for mobile {}, messageId: {}", cleanMobile, providerMessageId);

            if (smsDeliveryService != null) {
                smsDeliveryService.recordOutboundSms(clientSmsId, providerMessageId, cleanMobile, senderId, "ACCEPTED", String.valueOf(body));
            }

            return providerMessageId;
        } catch (HttpStatusCodeException e) {
            String responseBody = e.getResponseBodyAsString();
            log.error("DoveSoft JSON SMS HTTP error for mobile {}: status={}, body={}", cleanMobile, e.getStatusCode(), responseBody);
            String errDetail = responseBody;
            try {
                Map<?, ?> errMap = objectMapper.readValue(responseBody, Map.class);
                errDetail = extractErrorMessage(errMap);
            } catch (Exception ignored) {
            }
            if (smsDeliveryService != null) {
                smsDeliveryService.recordOutboundSms(clientSmsId, null, cleanMobile, senderId, "FAILED", responseBody);
            }
            throw new IllegalArgumentException("DoveSoft SMS send failed: " + errDetail);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("DoveSoft JSON SMS dispatch exception for mobile {}: {}", cleanMobile, e.getMessage(), e);
            throw new IllegalArgumentException("Failed to send SMS via DoveSoft: " + e.getMessage());
        }
    }

    /**
     * Explicitly send an OTP code using the approved DLT template.
     * Returns a composite provider reference "otpCode:providerMessageId".
     */
    public String sendOtpWithCode(String mobile, String otpCode) {
        if (otpCode == null || !otpCode.matches("^\\d{6}$")) {
            throw new IllegalArgumentException("OTP code must be a valid 6-digit number.");
        }
        String clientSmsId = "RUP-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
        String providerMsgId = sendJsonSms(mobile, otpCode, clientSmsId);
        return otpCode + ":" + providerMsgId;
    }

    @Override
    public String sendOtp(String mobile) {
        if (isUseJsonApi()) {
            int code = 100000 + secureRandom.nextInt(900000);
            String otpCode = String.valueOf(code);
            return sendOtpWithCode(mobile, otpCode);
        }
        return sendOtpViaLegacyGenerateOtp(mobile);
    }

    public String sendOtpViaLegacyGenerateOtp(String mobile) {
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
        }

        String senderId = getSenderId();
        if (!senderId.isBlank()) {
            urlBuilder.append("&senderid=").append(URLEncoder.encode(senderId, StandardCharsets.UTF_8));
        }

        String url = urlBuilder.toString();

        log.info("Sending OTP via DoveSoft for mobile {} (endpoint: {}/rest/generateOtp, entityid: {}, tempid: {}, senderid: {})",
                cleanMobile, baseUrl, entityId, tempId, senderId);

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

        String cleanMobile = cleanMobileNumber(mobile);
        if (cleanMobile.length() != 10) {
            log.warn("Invalid mobile length for DoveSoft verifyOtp: {}", mobile);
            return false;
        }

        String trimmedOtp = otp.trim();

        // 1. Check composite backend reference format "otpCode:providerMessageId"
        if (reference != null && !reference.isBlank()) {
            if (reference.startsWith(trimmedOtp + ":") || reference.equals(trimmedOtp)) {
                log.info("Backend composite OTP reference verified for mobile {}", cleanMobile);
                return true;
            }
        }

        // 2. Fallback to DoveSoft validateOtpApi if reference is an external otpId
        String apiKey = getApiKey();
        if (apiKey.isBlank()) {
            log.error("DoveSoft API Key not configured during OTP verification");
            return false;
        }

        String baseUrl = getBaseUrl();
        String encodedOtp = URLEncoder.encode(trimmedOtp, StandardCharsets.UTF_8);

        boolean hasOtpid = reference != null && !reference.isBlank()
                && !"success".equalsIgnoreCase(reference) && !"-1".equals(reference)
                && !reference.contains(":");

        String validateUrl = String.format("%s/rest/validateOtpApi?mobileno=%s&otp=%s", baseUrl, cleanMobile, encodedOtp);
        if (hasOtpid) {
            validateUrl += "&otpid=" + URLEncoder.encode(reference.trim(), StandardCharsets.UTF_8);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("key", apiKey);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        RestTemplate rt = restTemplateBuilder.build();

        try {
            log.info("Validating OTP via DoveSoft validateOtpApi for mobile {} (hasOtpid: {})", cleanMobile, hasOtpid);
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

        // Resilient fallback: Retry without otpid parameter if validate with otpid failed
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
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        RestTemplate rt = restTemplateBuilder.build();
        try {
            ResponseEntity<Map> response = rt.exchange(URI.create(url), HttpMethod.GET, entity, Map.class);
            return response.getBody() != null ? response.getBody() : Map.of("status", "empty");
        } catch (Exception e) {
            log.warn("DoveSoft getSmsTemplates call failed: {}", e.getMessage());
            return Map.of("status", "error", "message", String.valueOf(e.getMessage()));
        }
    }

    public Map<String, Object> getDiagnostics() {
        String key = getApiKey();
        String maskedKey = key.isBlank() ? "NOT_CONFIGURED" : (key.length() > 6 ? key.substring(0, 4) + "..." + key.substring(key.length() - 2) : "***");
        return Map.of(
                "apiKeyConfigured", !key.isBlank(),
                "apiKeyMasked", maskedKey,
                "baseUrl", getBaseUrl(),
                "useJsonApi", isUseJsonApi(),
                "resolvedMessageTemplate", resolveMessageTemplate(),
                "entityId", getEntityId(),
                "tempId", getTempId(),
                "senderId", getSenderId(),
                "templatesFromDoveSoft", fetchTemplates()
        );
    }

    public String extractErrorMessage(Map<?, ?> body) {
        if (body == null || body.isEmpty()) {
            return "Empty response from DoveSoft";
        }

        Object smslistObj = body.get("smslist");
        if (smslistObj instanceof Map<?, ?> smslistMap) {
            Object smsObj = smslistMap.get("sms");
            if (smsObj instanceof Map<?, ?> itemMap) {
                for (String field : List.of("reason", "msg", "message", "error", "description")) {
                    Object val = itemMap.get(field);
                    if (val != null && !String.valueOf(val).isBlank() && !"null".equalsIgnoreCase(String.valueOf(val)) && !"success".equalsIgnoreCase(String.valueOf(val))) {
                        return String.valueOf(val).trim();
                    }
                }
            }
        }

        for (String field : List.of("response", "msg", "reason", "message", "error", "description", "desc", "details", "Details", "data", "res")) {
            Object val = body.get(field);
            if (val != null && !String.valueOf(val).isBlank() && !"null".equalsIgnoreCase(String.valueOf(val))) {
                return String.valueOf(val).trim();
            }
        }

        Object result = body.get("result");
        if (result != null) {
            String resStr = String.valueOf(result).trim();
            if (!resStr.isBlank() && !"fail".equalsIgnoreCase(resStr) && !"false".equalsIgnoreCase(resStr)) {
                return resStr;
            }
        }

        return body.toString();
    }
}
