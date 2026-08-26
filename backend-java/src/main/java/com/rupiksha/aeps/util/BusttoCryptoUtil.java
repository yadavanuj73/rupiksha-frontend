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

        // 1. PRIORITY: Direct UTF-8 key — if the raw key is already a valid AES size (16, 24, 32 bytes)
        //    return it immediately WITHOUT any decoding.
        //    The BuckBox/Bustto portal provides the AES key as a raw ASCII/UTF-8 string.
        //    Hex/Base64 decoding must only be attempted when the raw key is NOT a valid size
        //    (e.g. 64-char hex-encoded or 44-char base64-encoded representation of the actual key).
        byte[] utfBytes = cleanKey.getBytes(StandardCharsets.UTF_8);
        if (utfBytes.length == 32 || utfBytes.length == 16 || utfBytes.length == 24) {
            log.info("[BusttoCrypto] Resolved AES key directly via UTF-8 bytes ({} bytes — standard AES key size)", utfBytes.length);
            return utfBytes;
        }

        // 2. Try Hex decoding — only relevant when the key is the HEX-ENCODED form of the real key
        //    e.g. 64 hex chars representing 32 raw bytes, or 32 hex chars representing 16 raw bytes.
        //    This path is NOT taken for normal 32-char ASCII keys.
        if (cleanKey.matches("^[0-9a-fA-F]+$") && (cleanKey.length() == 64 || cleanKey.length() == 48)) {
            try {
                int len = cleanKey.length();
                byte[] data = new byte[len / 2];
                for (int i = 0; i < len; i += 2) {
                    data[i / 2] = (byte) ((Character.digit(cleanKey.charAt(i), 16) << 4)
                            + Character.digit(cleanKey.charAt(i + 1), 16));
                }
                log.info("[BusttoCrypto] Resolved AES key via Hex decoding ({} bytes)", data.length);
                return data;
            } catch (Exception ignored) {}
        }

        // 3. Try Base64 decoding — for 44-char (padded) or 43-char (unpadded) keys.
        //    BuckBox portal may provide the AES key as standard Base64, URL-safe Base64,
        //    or unpadded Base64 — we try all three decoders.
        //    Standard:  uses '+' and '/', ends with '='
        //    URL-safe:  uses '-' and '_', may or may not have '=' padding
        //    Unpadded:  no trailing '=' characters
        boolean looksLikeBase64 = cleanKey.endsWith("=")
            || cleanKey.length() == 44
            || cleanKey.length() == 43;
        if (looksLikeBase64) {
            // Attempt A: Standard Base64
            try {
                byte[] decoded = Base64.getDecoder().decode(cleanKey);
                if (decoded.length == 32 || decoded.length == 16 || decoded.length == 24) {
                    log.info("[BusttoCrypto] Resolved AES key via Standard Base64 ({} bytes)", decoded.length);
                    return decoded;
                }
                if (decoded.length == 33) {
                    // 44-char unpadded Base64 with no '=' → 33 bytes; use first 32 for AES-256
                    log.info("[BusttoCrypto] Resolved AES key via Standard Base64 (33→32 bytes, first 32 used)");
                    return Arrays.copyOf(decoded, 32);
                }
            } catch (Exception ignored) {}

            // Attempt B: URL-safe Base64 (uses '-' and '_' instead of '+' and '/')
            try {
                byte[] decoded = Base64.getUrlDecoder().decode(cleanKey);
                if (decoded.length == 32 || decoded.length == 16 || decoded.length == 24) {
                    log.info("[BusttoCrypto] Resolved AES key via URL-safe Base64 ({} bytes)", decoded.length);
                    return decoded;
                }
                if (decoded.length == 33) {
                    log.info("[BusttoCrypto] Resolved AES key via URL-safe Base64 (33→32 bytes, first 32 used)");
                    return Arrays.copyOf(decoded, 32);
                }
            } catch (Exception ignored) {}

            // Attempt C: Unpadded Base64 — add '=' padding and retry standard decoder
            try {
                String padded = cleanKey;
                while (padded.length() % 4 != 0) padded += "=";
                byte[] decoded = Base64.getDecoder().decode(padded);
                if (decoded.length == 32 || decoded.length == 16 || decoded.length == 24) {
                    log.info("[BusttoCrypto] Resolved AES key via Unpadded Base64 (padded→{} bytes)", decoded.length);
                    return decoded;
                }
                if (decoded.length == 33) {
                    log.info("[BusttoCrypto] Resolved AES key via Unpadded Base64 (33→32 bytes, first 32 used)");
                    return Arrays.copyOf(decoded, 32);
                }
            } catch (Exception ignored) {}
        }

        // 4. Key length is non-standard — right-pad with zeros to 32 bytes (AES-256).
        //    Keys longer than 32 bytes are truncated to 32 bytes.
        log.warn("BUSTTO_AES_KEY is {} bytes (UTF-8) — not a standard AES key length. " +
                 "Right-padding to 32 bytes with zeros (AES-256). " +
                 "Verify the exact key value in your BuckBox merchant portal.", utfBytes.length);
        return Arrays.copyOf(utfBytes, 32);
    }


    private static byte[] pad(byte[] data, int blockSize) {
        int padLen = blockSize - (data.length % blockSize);
        byte[] padded = new byte[data.length + padLen];
        System.arraycopy(data, 0, padded, 0, data.length);
        for (int i = data.length; i < padded.length; i++) {
            padded[i] = (byte) padLen;
        }
        return padded;
    }

    private static byte[] unpad(byte[] data) {
        if (data == null || data.length == 0) return new byte[0];
        int padLen = data[data.length - 1] & 0xFF;
        if (padLen <= 0 || padLen > 16) {
            return data;
        }
        for (int i = data.length - padLen; i < data.length; i++) {
            if ((data[i] & 0xFF) != padLen) {
                return data;
            }
        }
        return Arrays.copyOfRange(data, 0, data.length - padLen);
    }

    private static byte[] multiply(byte[] x, byte[] y) {
        byte[] z = new byte[16];
        byte[] v = Arrays.copyOf(y, 16);
        for (int i = 0; i < 128; i++) {
            int byteIdx = i / 8;
            int bitIdx = 7 - (i % 8);
            if ((x[byteIdx] & (1 << bitIdx)) != 0) {
                for (int j = 0; j < 16; j++) {
                    z[j] ^= v[j];
                }
            }
            boolean carry = (v[15] & 1) != 0;
            for (int j = 15; j > 0; j--) {
                v[j] = (byte) (((v[j] & 0xFF) >>> 1) | ((v[j - 1] & 1) << 7));
            }
            v[0] = (byte) ((v[0] & 0xFF) >>> 1);
            if (carry) {
                v[0] ^= (byte) 0xE1;
            }
        }
        return z;
    }

    private static byte[] calculateY0(byte[] key, byte[] iv) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/ECB/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"));
        byte[] h = cipher.doFinal(new byte[16]);

        byte[] block1 = Arrays.copyOf(iv, 16);
        byte[] block2 = new byte[16];
        block2[15] = (byte) 0x80;

        byte[] v1 = multiply(block1, h);
        for (int i = 0; i < 16; i++) {
            v1[i] ^= block2[i];
        }
        byte[] y0 = multiply(v1, h);
        return y0;
    }

    private static byte[] incrementY(byte[] y0) {
        byte[] y1 = Arrays.copyOf(y0, 16);
        for (int i = 15; i >= 12; i--) {
            y1[i]++;
            if (y1[i] != 0) {
                break;
            }
        }
        return y1;
    }

    /**
     * Encrypts the raw JSON payload with the merchant AES secret key using standard GCM mode.
     * Matches BuckBox GCM implementation with standard 16-byte GCM tag appended.
     */
    public static String encrypt(String secretKey, String payload) throws Exception {
        if (payload == null) {
            payload = "";
        }

        byte[] keyBytes = resolveKeyBytes(secretKey);
        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

        byte[] iv = new byte[IV_LENGTH];
        new SecureRandom().nextBytes(iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(128, iv));
        
        byte[] plaintextBytes = payload.getBytes(StandardCharsets.UTF_8);
        byte[] paddedPlaintext = pad(plaintextBytes, 16);
        byte[] encryptedWithTag = cipher.doFinal(paddedPlaintext);

        ByteBuffer combined = ByteBuffer.allocate(iv.length + encryptedWithTag.length);
        combined.put(iv);
        combined.put(encryptedWithTag);
        return Base64.getEncoder().encodeToString(combined.array());
    }

    /**
     * Decrypts the Base64-encoded encrypted payload returned from BuckBox/Bustto.
     *
     * Format expected (per provider documentation):
     *   Base64( IV[16 bytes] + AES-256-GCM-Ciphertext + GCM-Tag[16 bytes] )
     *
     * The GCM authentication tag is appended to the ciphertext by Java's AES/GCM/NoPadding cipher
     * and is included in cipherBytes. Java's GCM implementation expects the tag to be the last 16
     * bytes of the ciphertext block, which matches the provider's format.
     *
     * The provider also applies PKCS7-style padding before encrypting (as shown in the Python sample),
     * so we unpad after decryption.
     *
     * IMPORTANT: GCM authentication tag verification is mandatory and must NOT be bypassed.
     * If the MAC check fails it means the key is wrong, the ciphertext is corrupted, or the
     * response format does not match. Do NOT add fallback modes that skip tag verification.
     */
    public static String decrypt(String secretKey, String encrypted) throws Exception {
        if (encrypted == null || encrypted.isBlank()) {
            return "";
        }

        byte[] all = Base64.getDecoder().decode(encrypted.trim());
        if (all.length <= IV_LENGTH) {
            throw new IllegalArgumentException(
                "AES decryption failed: payload too short (" + all.length + " bytes). " +
                "Minimum expected: IV(" + IV_LENGTH + ") + 1 byte ciphertext + 16 byte GCM tag.");
        }

        byte[] iv          = Arrays.copyOfRange(all, 0, IV_LENGTH);
        byte[] cipherBytes = Arrays.copyOfRange(all, IV_LENGTH, all.length);

        byte[] keyBytes = resolveKeyBytes(secretKey);
        log.debug("[BusttoCrypto] decrypt: payload bytes={}, IV bytes={}, ciphertext+tag bytes={}, key bytes={}",
            all.length, iv.length, cipherBytes.length, keyBytes.length);

        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

        try {
            // AES-256-GCM with 128-bit authentication tag.
            // Java's GCM implementation appends the tag to the ciphertext on encrypt,
            // and expects it there on decrypt — exactly the format the provider uses.
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);

            // Remove PKCS7 padding applied before encryption (matches Python/PHP provider samples)
            byte[] unpadded = unpad(decrypted);
            return new String(unpadded, StandardCharsets.UTF_8);

        } catch (Exception e) {
            // GCM tag failure = key mismatch, tampered data, or wrong ciphertext format.
            // Log safely (no key or payload values) and re-throw with a clear message.
            log.error("[BusttoCrypto] AES decryption failed: {}. " +
                "Check that BUSTTO_AES_KEY matches the key in your BuckBox merchant portal " +
                "and that the response format is Base64(IV[16]+ciphertext+tag[16]).",
                e.getMessage());
            throw new RuntimeException("AES decryption failed: " + e.getMessage(), e);
        }
    }
}

