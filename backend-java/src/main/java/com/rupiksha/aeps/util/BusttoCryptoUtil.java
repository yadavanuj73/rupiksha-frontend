package com.rupiksha.aeps.util;

import lombok.extern.slf4j.Slf4j;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Slf4j
public class BusttoCryptoUtil {

    private static final int IV_LENGTH = 16;
    private static final int TAG_LENGTH_BIT = 128;

    /**
     * Resolves the AES secret key into a valid 16, 24, or 32-byte binary key.
     * Handles:
     * - Base64 encoded keys (e.g. 44 characters for a 32-byte / 256-bit key)
     * - Hex encoded keys (e.g. 64 characters)
     * - Raw UTF-8 string keys
     * - SHA-256 fallback derivation to guarantee a valid 256-bit key
     */
    public static byte[] resolveKeyBytes(String secretKey) {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalArgumentException("AES secret key is missing");
        }
        String cleanKey = secretKey.trim();

        // 1. Try Base64 decoding (e.g. 44-character Base64 string -> 32 bytes)
        try {
            byte[] decoded = Base64.getDecoder().decode(cleanKey);
            if (decoded.length == 16 || decoded.length == 24 || decoded.length == 32) {
                return decoded;
            }
        } catch (Exception ignored) {}

        // 2. Try Hex decoding (e.g. 64 hex chars -> 32 bytes, 32 hex chars -> 16 bytes)
        if (cleanKey.matches("^[0-9a-fA-F]+$") && (cleanKey.length() == 32 || cleanKey.length() == 48 || cleanKey.length() == 64)) {
            try {
                int len = cleanKey.length();
                byte[] data = new byte[len / 2];
                for (int i = 0; i < len; i += 2) {
                    data[i / 2] = (byte) ((Character.digit(cleanKey.charAt(i), 16) << 4)
                            + Character.digit(cleanKey.charAt(i + 1), 16));
                }
                return data;
            } catch (Exception ignored) {}
        }

        // 3. Check direct UTF-8 string bytes
        byte[] utfBytes = cleanKey.getBytes(StandardCharsets.UTF_8);
        if (utfBytes.length == 16 || utfBytes.length == 24 || utfBytes.length == 32) {
            return utfBytes;
        }

        // 4. SHA-256 fallback derivation to guarantee 32 bytes (256-bit AES)
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return md.digest(utfBytes);
        } catch (Exception e) {
            throw new RuntimeException("Failed to derive 256-bit AES key", e);
        }
    }

    /**
     * Encrypts the raw JSON payload with the merchant AES secret key.
     * Uses a 16-byte random IV, prepends IV to ciphertext, and Base64-encodes the result.
     */
    public static String encrypt(String secretKey, String payload) throws Exception {
        if (payload == null) {
            payload = "";
        }

        byte[] keyBytes = resolveKeyBytes(secretKey);
        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");
        
        byte[] iv = new byte[IV_LENGTH];
        SecureRandom random = new SecureRandom();
        random.nextBytes(iv);

        byte[] encrypted;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
            encrypted = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            try {
                Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
                cipher.init(Cipher.ENCRYPT_MODE, keySpec, new IvParameterSpec(iv));
                encrypted = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            } catch (Exception ex) {
                Cipher cipher = Cipher.getInstance("AES/CTR/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, keySpec, new IvParameterSpec(iv));
                encrypted = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            }
        }

        ByteBuffer combined = ByteBuffer.allocate(iv.length + encrypted.length);
        combined.put(iv);
        combined.put(encrypted);

        return Base64.getEncoder().encodeToString(combined.array());
    }

    /**
     * Decrypts the Base64-encoded encrypted payload returned from the API.
     * Supports standard GCM with tag, Python GCM without tag (CTR mode), and CBC.
     */
    public static String decrypt(String secretKey, String encrypted) throws Exception {
        if (encrypted == null || encrypted.isBlank()) {
            return "";
        }

        byte[] all = Base64.getDecoder().decode(encrypted.trim());
        if (all.length <= IV_LENGTH) {
            throw new IllegalArgumentException("Invalid encrypted payload length: " + all.length);
        }

        byte[] iv = Arrays.copyOfRange(all, 0, IV_LENGTH);
        byte[] cipherBytes = Arrays.copyOfRange(all, IV_LENGTH, all.length);

        byte[] keyBytes = resolveKeyBytes(secretKey);
        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

        // Attempt 1: Standard AES/GCM/NoPadding with 128-bit tag
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);
            return unpadString(decrypted);
        } catch (Exception e1) {
            log.debug("GCM 128-bit decryption failed: {}, trying CTR/CBC fallbacks", e1.getMessage());
        }

        // Attempt 2: AES/CTR/NoPadding (Python AES.MODE_GCM without digest tag)
        try {
            Cipher cipher = Cipher.getInstance("AES/CTR/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);
            return unpadString(decrypted);
        } catch (Exception e2) {
            log.debug("CTR decryption failed: {}", e2.getMessage());
        }

        // Attempt 3: AES/CBC/PKCS5Padding
        try {
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e3) {
            log.debug("CBC PKCS5 decryption failed: {}", e3.getMessage());
        }

        // Attempt 4: AES/CBC/NoPadding with manual unpadding
        try {
            Cipher cipher = Cipher.getInstance("AES/CBC/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);
            return unpadString(decrypted);
        } catch (Exception e4) {
            throw new RuntimeException("All decryption modes failed for payload", e4);
        }
    }

    private static String unpadString(byte[] data) {
        if (data == null || data.length == 0) return "";
        int len = data.length;
        int pad = data[len - 1] & 0xFF;
        if (pad > 0 && pad <= 16 && len >= pad) {
            boolean valid = true;
            for (int i = len - pad; i < len; i++) {
                if ((data[i] & 0xFF) != pad) {
                    valid = false;
                    break;
                }
            }
            if (valid) {
                return new String(data, 0, len - pad, StandardCharsets.UTF_8);
            }
        }
        return new String(data, StandardCharsets.UTF_8);
    }
}
