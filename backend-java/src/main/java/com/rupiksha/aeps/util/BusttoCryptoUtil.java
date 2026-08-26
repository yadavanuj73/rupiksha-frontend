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
            Cipher cipher = Cipher.getInstance("AES/GCM/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new IvParameterSpec(iv));
            encrypted = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
                encrypted = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            } catch (Exception ex) {
                Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
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
     */
    public static String decrypt(String secretKey, String encrypted) throws Exception {
        if (encrypted == null || encrypted.isBlank()) {
            return "";
        }

        byte[] all = Base64.getDecoder().decode(encrypted.trim());
        if (all.length < IV_LENGTH) {
            throw new IllegalArgumentException("Invalid encrypted payload length");
        }

        byte[] iv = Arrays.copyOfRange(all, 0, IV_LENGTH);
        byte[] cipherBytes = Arrays.copyOfRange(all, IV_LENGTH, all.length);

        byte[] keyBytes = resolveKeyBytes(secretKey);
        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

        byte[] decrypted;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
            decrypted = cipher.doFinal(cipherBytes);
        } catch (Exception e) {
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
                decrypted = cipher.doFinal(cipherBytes);
            } catch (Exception ex) {
                Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
                cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
                decrypted = cipher.doFinal(cipherBytes);
            }
        }

        return new String(decrypted, StandardCharsets.UTF_8);
    }
}
