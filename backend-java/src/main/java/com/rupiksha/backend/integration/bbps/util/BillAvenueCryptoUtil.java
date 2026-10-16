package com.rupiksha.backend.integration.bbps.util;

import lombok.extern.slf4j.Slf4j;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Base64;

@Slf4j
public final class BillAvenueCryptoUtil {

    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/CBC/PKCS5Padding";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    // Standard BillAvenue default 16-byte IV: 0, 1, 2, ..., 15
    private static final byte[] DEFAULT_IV = new byte[]{
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
            0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f
    };

    private BillAvenueCryptoUtil() {}

    /**
     * Generates a 35-character unique Request ID conforming to BillAvenue specification:
     * <random characters of length 27><YDDDhhmm>
     * Y   = last digit of current year (e.g. 6 for 2026)
     * DDD = nth day of the current year (3-digit zero-padded, e.g. 289)
     * hh  = 24-hour format (2-digit zero-padded, 00-23)
     * mm  = minutes (2-digit zero-padded, 00-59)
     */
    public static String generateRequestId() {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Kolkata"));
        int year = now.getYear();
        int dayOfYear = now.getDayOfYear();
        int hour = now.getHour();
        int minute = now.getMinute();

        String suffix = String.format("%d%03d%02d%02d", year % 10, dayOfYear, hour, minute);

        StringBuilder prefix = new StringBuilder(27);
        for (int i = 0; i < 27; i++) {
            prefix.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
        }

        return prefix.append(suffix).toString();
    }

    /**
     * Encrypts plaintext string using AES-128-CBC with PKCS5Padding.
     * Returns hexadecimal representation as required by BillAvenue.
     */
    public static String encrypt(String plainText, String workingKey, String customIv) {
        if (plainText == null || workingKey == null || workingKey.isBlank()) {
            throw new IllegalArgumentException("Plaintext and workingKey must not be null/blank");
        }
        try {
            byte[] keyBytes = derive16ByteKey(workingKey);
            byte[] ivBytes = resolveIv(customIv);

            SecretKeySpec secretKeySpec = new SecretKeySpec(keyBytes, ALGORITHM);
            IvParameterSpec ivSpec = new IvParameterSpec(ivBytes);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec, ivSpec);

            byte[] encryptedBytes = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(encryptedBytes);
        } catch (Exception e) {
            log.error("Error encrypting BillAvenue request payload", e);
            throw new RuntimeException("BillAvenue encryption error: " + e.getMessage(), e);
        }
    }

    /**
     * Decrypts ciphertext (either Hex or Base64 encoded) using AES-128-CBC with PKCS5Padding.
     */
    public static String decrypt(String cipherText, String workingKey, String customIv) {
        if (cipherText == null || cipherText.isBlank() || workingKey == null || workingKey.isBlank()) {
            throw new IllegalArgumentException("Ciphertext and workingKey must not be null/blank");
        }
        try {
            byte[] keyBytes = derive16ByteKey(workingKey);
            byte[] ivBytes = resolveIv(customIv);
            byte[] cipherBytes;

            String trimmed = cipherText.trim();
            if (isHex(trimmed)) {
                cipherBytes = hexToBytes(trimmed);
            } else {
                cipherBytes = Base64.getDecoder().decode(trimmed);
            }

            SecretKeySpec secretKeySpec = new SecretKeySpec(keyBytes, ALGORITHM);
            IvParameterSpec ivSpec = new IvParameterSpec(ivBytes);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, secretKeySpec, ivSpec);

            byte[] decryptedBytes = cipher.doFinal(cipherBytes);
            return new String(decryptedBytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Error decrypting BillAvenue response payload", e);
            throw new RuntimeException("BillAvenue decryption error: " + e.getMessage(), e);
        }
    }

    private static byte[] resolveIv(String customIv) {
        if (customIv == null || customIv.isBlank()) {
            return DEFAULT_IV;
        }
        String clean = customIv.trim();
        if (clean.length() == 16) {
            return clean.getBytes(StandardCharsets.UTF_8);
        }
        if (clean.length() == 32 && isHex(clean)) {
            return hexToBytes(clean);
        }
        return DEFAULT_IV;
    }

    private static byte[] derive16ByteKey(String key) {
        byte[] raw = key.trim().getBytes(StandardCharsets.UTF_8);
        if (raw.length == 16) {
            return raw;
        }
        if (key.trim().length() == 32 && isHex(key.trim())) {
            return hexToBytes(key.trim());
        }
        try {
            // BillAvenue standard kit creates 16-byte key via MD5 digest if key is not raw 16 bytes
            MessageDigest md = MessageDigest.getInstance("MD5");
            return md.digest(raw);
        } catch (Exception e) {
            byte[] key16 = new byte[16];
            System.arraycopy(raw, 0, key16, 0, Math.min(raw.length, 16));
            return key16;
        }
    }

    public static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    public static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }

    private static boolean isHex(String s) {
        if (s.length() % 2 != 0) return false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            boolean isHexChar = (c >= '0' && c <= '9') ||
                    (c >= 'a' && c <= 'f') ||
                    (c >= 'A' && c <= 'F');
            if (!isHexChar) return false;
        }
        return true;
    }
}
