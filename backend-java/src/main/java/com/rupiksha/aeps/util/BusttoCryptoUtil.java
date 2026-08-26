package com.rupiksha.aeps.util;

import lombok.extern.slf4j.Slf4j;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Slf4j
public class BusttoCryptoUtil {

    private static final int IV_LENGTH = 16;
    private static final int TAG_LENGTH_BIT = 128;

    /**
     * Resolves the AES secret key into a valid 16, 24, or 32-byte binary key.
     * Sanitizes quotes and whitespace.
     */
    public static byte[] resolveKeyBytes(String secretKey) {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalArgumentException(
                "BUSTTO_AES_KEY is not configured. Set it to the AES encryption key " +
                "from your BuckBox merchant portal."
            );
        }
        String cleanKey = secretKey.trim();
        if ((cleanKey.startsWith("\"") && cleanKey.endsWith("\"")) ||
            (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
            cleanKey = cleanKey.substring(1, cleanKey.length() - 1).trim();
        }

        // 1. Direct UTF-8 key — exact 16, 24, or 32-byte key as provided by BuckBox
        byte[] utfBytes = cleanKey.getBytes(StandardCharsets.UTF_8);
        if (utfBytes.length == 32 || utfBytes.length == 16 || utfBytes.length == 24) {
            return utfBytes;
        }

        // 2. Base64 decoded key (44-char Base64 = 32 bytes, or any Base64 string ending with '=')
        if (cleanKey.length() == 44 || cleanKey.endsWith("=")) {
            try {
                byte[] decoded = Base64.getDecoder().decode(cleanKey);
                if (decoded.length == 32 || decoded.length == 16 || decoded.length == 24) {
                    return decoded;
                }
            } catch (Exception ignored) {}
        }

        // 3. Hex decoded key (64 hex chars -> 32 bytes, 32 hex chars -> 16 bytes)
        if (cleanKey.matches("^[0-9a-fA-F]+$") && (cleanKey.length() == 64 || cleanKey.length() == 32)) {
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

        // 4. Key length is non-standard — right-pad with zeros to 32 bytes (AES-256).
        //    This matches common payment gateway SDK behaviour where a shorter passphrase
        //    is used as-is with zero-byte padding to reach a valid AES key length.
        //    Keys longer than 32 bytes are truncated to 32 bytes.
        log.warn("BUSTTO_AES_KEY is {} bytes (UTF-8) — not a standard AES key length. " +
                 "Right-padding to 32 bytes with zeros (AES-256). " +
                 "Verify the exact key value in your BuckBox merchant portal.", utfBytes.length);
        return Arrays.copyOf(utfBytes, 32);  // copyOf right-pads with zeros if shorter, truncates if longer
    }

    /**
     * Encrypts the raw JSON payload with the merchant AES secret key.
     *
     * BuckBox/Bustto format (from official Python doc):
     *   base64([IV (16 bytes)] + [PKCS7-padded ciphertext])
     *
     * The BuckBox Python sample uses PyCryptodome AES-GCM in pure stream-cipher mode:
     *   cipher.encrypt(padded_payload) → ciphertext only (NO auth tag appended).
     * This is functionally identical to AES-CBC with PKCS7 padding.
     * We use AES/CBC/PKCS5Padding here to produce the exact same byte layout.
     *
     * IMPORTANT: Do NOT use AES/GCM/NoPadding with doFinal() here — Java's GCM doFinal()
     * appends a 16-byte auth tag that BuckBox does NOT expect, causing "MAC check failed".
     */
    public static String encrypt(String secretKey, String payload) throws Exception {
        if (payload == null) {
            payload = "";
        }

        byte[] keyBytes = resolveKeyBytes(secretKey);
        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

        byte[] iv = new byte[IV_LENGTH];
        new SecureRandom().nextBytes(iv);

        // AES/CBC/PKCS5Padding matches BuckBox's [IV + PKCS7-padded-ciphertext] format exactly.
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, new IvParameterSpec(iv));
        byte[] ciphertext = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));

        // Output: [IV (16 bytes)] + [PKCS7-padded ciphertext]  — no GCM auth tag
        ByteBuffer combined = ByteBuffer.allocate(iv.length + ciphertext.length);
        combined.put(iv);
        combined.put(ciphertext);
        return Base64.getEncoder().encodeToString(combined.array());
    }

    /**
     * Decrypts the Base64-encoded encrypted payload returned from BuckBox.
     * Tries AES/CBC/PKCS5Padding first (BuckBox's primary format), then GCM and other fallbacks.
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

        // Attempt 1: AES/CBC/PKCS5Padding — BuckBox's primary format matching their Python doc
        try {
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e1) {
            log.debug("CBC PKCS5 decryption failed: {}, trying other modes", e1.getMessage());
        }

        // Attempt 2: AES/GCM/NoPadding with 128-bit tag (standard GCM with auth tag)
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e2) {
            log.debug("GCM 128-bit decryption failed: {}", e2.getMessage());
        }

        // Attempt 3: AES/CTR/NoPadding (PyCryptodome GCM stream mode without digest tag)
        try {
            Cipher cipher = Cipher.getInstance("AES/CTR/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);
            return unpadString(decrypted);
        } catch (Exception e3) {
            log.debug("CTR decryption failed: {}", e3.getMessage());
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
