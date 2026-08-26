package com.rupiksha.aeps.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
public class BusttoJwtUtil {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static String cachedToken = null;
    private static long cachedTokenExpiry = 0;
    private static String cachedKey = "";

    /**
     * Generates a 7-day valid JWT token signed with standard HMAC-SHA256 using the merchant secret key.
     * Complies 100% with Python 'jose.jwt.encode' specification as outlined in Bustto documentation.
     */
    public static synchronized String generateOrGetToken(
            String secretKey,
            String merchantId,
            String merchantName,
            String merchantEmail
    ) {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalArgumentException("JWT Secret key is missing");
        }

        String cleanKey = secretKey.trim();
        String cleanMerchantId = merchantId != null ? merchantId.trim() : "";
        String cleanName = merchantName != null ? merchantName.trim() : "";
        String cleanEmail = merchantEmail != null ? merchantEmail.trim() : "";

        long nowSeconds = System.currentTimeMillis() / 1000L;
        // Check cache validity (must have at least 24 hours remaining)
        if (cachedToken != null && cleanKey.equals(cachedKey) && (cachedTokenExpiry - nowSeconds) > (24 * 3600L)) {
            return cachedToken;
        }

        try {
            long validitySeconds = 7L * 24 * 3600L; // 7 days in seconds
            long expSeconds = nowSeconds + validitySeconds;

            // 1. Standard Header
            Map<String, String> headerMap = new LinkedHashMap<>();
            headerMap.put("alg", "HS256");
            headerMap.put("typ", "JWT");
            String headerJson = MAPPER.writeValueAsString(headerMap);
            String headerBase64 = Base64.getUrlEncoder().withoutPadding().encodeToString(headerJson.getBytes(StandardCharsets.UTF_8));

            // 2. Standard Claims Payload
            Map<String, Object> payloadMap = new LinkedHashMap<>();
            payloadMap.put("merchant_id", cleanMerchantId);
            payloadMap.put("name", cleanName);
            payloadMap.put("email", cleanEmail);
            payloadMap.put("exp", expSeconds);
            String payloadJson = MAPPER.writeValueAsString(payloadMap);
            String payloadBase64 = Base64.getUrlEncoder().withoutPadding().encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));

            // 3. HMAC-SHA256 Signature
            String signingInput = headerBase64 + "." + payloadBase64;
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(cleanKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] signatureBytes = mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8));
            String signatureBase64 = Base64.getUrlEncoder().withoutPadding().encodeToString(signatureBytes);

            String token = signingInput + "." + signatureBase64;

            cachedToken = token;
            cachedTokenExpiry = expSeconds;
            cachedKey = cleanKey;

            log.debug("Generated Bustto JWT Token successfully for merchant: {}", cleanMerchantId);
            return token;

        } catch (Exception e) {
            log.error("Failed to generate JWT token: {}", e.getMessage(), e);
            throw new RuntimeException("Could not generate JWT authentication token", e);
        }
    }
}
