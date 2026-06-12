package com.payout.payout.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class SignatureUtil {

    // rawData = apiKey|timestamp|requestJson
    // signature = SHA256(rawData)
    public static String generateSignature(String apiKey, String timestamp, String requestJson) {
        try {
            String rawData = apiKey + "|" + timestamp + "|" + requestJson;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawData.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                hexString.append(String.format("%02x", b));
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("Signature generation failed", e);
        }
    }

    // Format: yyyy-MM-dd HH:mm:ss
    public static String getCurrentTimestamp() {
        return LocalDateTime.now()
            .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
}
