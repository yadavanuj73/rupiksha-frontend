package com.rupiksha.aeps.util;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Slf4j
public class BusttoJwtUtil {

    private static String cachedToken = null;
    private static long cachedTokenExpiry = 0;

    /**
     * Generates a 7-day valid JWT token signed with HMAC-SHA256 using the merchant secret key.
     * Caches token in memory and refreshes when within 1 day of expiration.
     */
    public static synchronized String generateOrGetToken(
            String secretKey,
            String merchantId,
            String merchantName,
            String merchantEmail
    ) {
        long now = System.currentTimeMillis();
        // Return cached token if valid for at least 24 more hours
        if (cachedToken != null && (cachedTokenExpiry - now) > 24 * 60 * 60 * 1000L) {
            return cachedToken;
        }

        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalArgumentException("JWT Secret key is missing");
        }

        long validityMillis = 7L * 24 * 60 * 60 * 1000L; // 7 days
        Date exp = new Date(now + validityMillis);

        byte[] keyBytes = secretKey.getBytes(StandardCharsets.UTF_8);
        SecretKey hmacKey = Keys.hmacShaKeyFor(keyBytes);

        Map<String, Object> claims = new HashMap<>();
        claims.put("merchant_id", merchantId != null ? merchantId : "");
        claims.put("name", merchantName != null ? merchantName : "");
        claims.put("email", merchantEmail != null ? merchantEmail : "");

        String token = Jwts.builder()
                .claims(claims)
                .expiration(exp)
                .signWith(hmacKey)
                .compact();

        cachedToken = token;
        cachedTokenExpiry = exp.getTime();
        return token;
    }
}
