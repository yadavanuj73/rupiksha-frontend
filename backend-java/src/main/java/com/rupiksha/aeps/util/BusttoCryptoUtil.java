package com.rupiksha.aeps.util;

import lombok.extern.slf4j.Slf4j;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Slf4j
public class BusttoCryptoUtil {

    // BuckBox / Bustto specification:
    // IV = 16 bytes, GCM Tag = 16 bytes (128 bits).
    // Packet layout: Base64( IV[16 bytes] + TAG[16 bytes] + CIPHERTEXT[N bytes] )
    private static final int IV_LENGTH = 16;
    private static final int TAG_LENGTH_BYTE = 16;
    private static final int TAG_LENGTH_BIT = 128;

    /**
     * Resolves the AES secret key into a valid binary key (typically 32 bytes for AES-256).
     * Handles Base64 (padded/unpadded/URL-safe), raw UTF-8, and Hex encodings.
     */
    public static byte[] resolveKeyBytes(String secretKey) {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalArgumentException(
                "BUSTTO_AES_KEY / BUSTTO_ENCRYPTION_KEY is not configured. " +
                "Set it to the AES encryption key from your BuckBox merchant portal."
            );
        }
        String cleanKey = secretKey.trim();
        if ((cleanKey.startsWith("\"") && cleanKey.endsWith("\"")) ||
            (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
            cleanKey = cleanKey.substring(1, cleanKey.length() - 1).trim();
        }

        // 1. Base64 decoding (supports standard and URL-safe keys)
        //    A 32-byte (256-bit) key is represented in Base64 as 43 or 44 characters.
        if (cleanKey.length() == 44 || cleanKey.length() == 43 || cleanKey.contains("=") || cleanKey.contains("+") || cleanKey.contains("/") || cleanKey.contains("-") || cleanKey.contains("_")) {
            try {
                String base64Str = cleanKey.replace('-', '+').replace('_', '/');
                while (base64Str.length() % 4 != 0) {
                    base64Str += "=";
                }
                byte[] decoded = Base64.getDecoder().decode(base64Str);
                if (decoded.length == 32 || decoded.length == 16 || decoded.length == 24) {
                    log.info("[BusttoCrypto] Resolved AES key via Base64 decoding ({} bytes)", decoded.length);
                    return decoded;
                }
            } catch (Exception ignored) {}
        }

        // 2. Direct UTF-8 bytes if already a standard AES key length (16, 24, 32 bytes)
        byte[] utfBytes = cleanKey.getBytes(StandardCharsets.UTF_8);
        if (utfBytes.length == 32 || utfBytes.length == 16 || utfBytes.length == 24) {
            log.info("[BusttoCrypto] Resolved AES key directly via UTF-8 bytes ({} bytes)", utfBytes.length);
            return utfBytes;
        }

        // 3. Hex decoding (64 hex characters = 32 bytes, 48 hex chars = 24 bytes, 32 hex chars = 16 bytes)
        if (cleanKey.matches("^[0-9a-fA-F]+$") && (cleanKey.length() == 64 || cleanKey.length() == 48 || cleanKey.length() == 32)) {
            try {
                int len = cleanKey.length();
                byte[] data = new byte[len / 2];
                for (int i = 0; i < len; i += 2) {
                    data[i / 2] = (byte) ((Character.digit(cleanKey.charAt(i), 16) << 4)
                            + Character.digit(cleanKey.charAt(i + 1), 16));
                }
                if (data.length == 32 || data.length == 16 || data.length == 24) {
                    log.info("[BusttoCrypto] Resolved AES key via Hex decoding ({} bytes)", data.length);
                    return data;
                }
            } catch (Exception ignored) {}
        }

        // 4. Fallback: pad or truncate to 32 bytes (AES-256)
        log.warn("[BusttoCrypto] Key length ({} bytes) is non-standard. Adjusting to 32 bytes (AES-256).", utfBytes.length);
        return Arrays.copyOf(utfBytes, 32);
    }

    /**
     * Encrypts the raw JSON payload per BuckBox / Bustto production specification.
     *
     * Format:
     *   Base64( IV[16 bytes] + TAG[16 bytes] + AES-256-GCM-CIPHERTEXT[N bytes] )
     */
    public static String encrypt(String secretKey, String payload) throws Exception {
        if (payload == null) payload = "";

        byte[] keyBytes = resolveKeyBytes(secretKey);
        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

        byte[] iv = new byte[IV_LENGTH];
        new SecureRandom().nextBytes(iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));

        byte[] plaintextBytes = payload.getBytes(StandardCharsets.UTF_8);
        byte[] cipherAndTag = cipher.doFinal(plaintextBytes);

        // Java AES/GCM/NoPadding appends 16-byte auth tag at the end: [ciphertext][tag]
        int ciphertextLen = cipherAndTag.length - TAG_LENGTH_BYTE;
        byte[] ciphertext = Arrays.copyOfRange(cipherAndTag, 0, ciphertextLen);
        byte[] tag = Arrays.copyOfRange(cipherAndTag, ciphertextLen, cipherAndTag.length);

        // Packet layout matching Bustto specification: IV (16) + TAG (16) + CIPHERTEXT (N)
        ByteBuffer combined = ByteBuffer.allocate(IV_LENGTH + TAG_LENGTH_BYTE + ciphertextLen);
        combined.put(iv);
        combined.put(tag);
        combined.put(ciphertext);

        log.debug("[BusttoCrypto] encrypt: IV={} bytes, tag={} bytes, ciphertext={} bytes, key={} bytes",
                iv.length, tag.length, ciphertext.length, keyBytes.length);

        return Base64.getEncoder().encodeToString(combined.array());
    }

    /**
     * Decrypts the Base64-encoded response from BuckBox / Bustto.
     *
     * Format:
     *   Base64( IV[16 bytes] + TAG[16 bytes] + CIPHERTEXT[N bytes] )
     *
     * Also supports fallback formats (e.g. Java standard IV + Ciphertext + Tag).
     */
    public static String decrypt(String secretKey, String encrypted) throws Exception {
        if (encrypted == null || encrypted.isBlank()) return "";

        byte[] all = Base64.getDecoder().decode(encrypted.trim());
        if (all.length < (IV_LENGTH + TAG_LENGTH_BYTE)) {
            throw new IllegalArgumentException(
                "AES decryption failed: payload too short (" + all.length + " bytes). " +
                "Expected at least IV (" + IV_LENGTH + " bytes) + TAG (" + TAG_LENGTH_BYTE + " bytes).");
        }

        byte[] keyBytes = resolveKeyBytes(secretKey);
        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

        // Format 1: Bustto specification: IV (16) + TAG (16) + CIPHERTEXT (rest)
        try {
            byte[] iv = Arrays.copyOfRange(all, 0, IV_LENGTH);
            byte[] tag = Arrays.copyOfRange(all, IV_LENGTH, IV_LENGTH + TAG_LENGTH_BYTE);
            byte[] ciphertext = Arrays.copyOfRange(all, IV_LENGTH + TAG_LENGTH_BYTE, all.length);

            // Reconstruct [ciphertext][tag] for Java AES/GCM/NoPadding DECRYPT_MODE
            byte[] cipherAndTag = new byte[ciphertext.length + TAG_LENGTH_BYTE];
            System.arraycopy(ciphertext, 0, cipherAndTag, 0, ciphertext.length);
            System.arraycopy(tag, 0, cipherAndTag, ciphertext.length, TAG_LENGTH_BYTE);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
            byte[] decrypted = cipher.doFinal(cipherAndTag);

            log.debug("[BusttoCrypto] decrypt (IV+Tag+Cipher) successful: {} bytes decrypted", decrypted.length);
            return new String(decrypted, StandardCharsets.UTF_8);

        } catch (Exception e1) {
            log.debug("[BusttoCrypto] Primary GCM decrypt (IV+Tag+Cipher) failed: {}, trying fallback format (IV+Cipher+Tag)", e1.getMessage());

            // Format 2 fallback: Standard Java format: IV (16) + CIPHERTEXT (rest - 16) + TAG (16)
            try {
                byte[] iv = Arrays.copyOfRange(all, 0, IV_LENGTH);
                byte[] cipherAndTag = Arrays.copyOfRange(all, IV_LENGTH, all.length);

                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
                byte[] decrypted = cipher.doFinal(cipherAndTag);

                log.debug("[BusttoCrypto] fallback decrypt (IV+Cipher+Tag) successful");
                return new String(decrypted, StandardCharsets.UTF_8);
            } catch (Exception e2) {
                log.error("[BusttoCrypto] AES decryption failed: {}. Verify BUSTTO_AES_KEY / BUSTTO_ENCRYPTION_KEY.", e1.getMessage());
                throw new RuntimeException("AES decryption failed: " + e1.getMessage(), e1);
            }
        }
    }
}
