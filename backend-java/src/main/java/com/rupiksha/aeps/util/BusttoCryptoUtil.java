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

    // BuckBox spec: IV = 16 bytes — all their sample codes use randomBytes(16) / BLOCK_SIZE=16.
    // Their Python, Node.js, PHP, and Java samples all generate a 16-byte IV.
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
     * Encrypts the raw JSON payload per BuckBox specification.
     *
     * BuckBox format (from official documentation and all sample codes):
     *   Base64( IV[16 bytes] + AES-256-GCM-ciphertext-WITHOUT-auth-tag )
     *
     * Key points from their docs:
     *   - IV: 16 random bytes (randomBytes(BLOCK_SIZE) where BLOCK_SIZE=16)
     *   - Manual PKCS7 padding before encrypting (Python sample shows this explicitly)
     *   - The GCM auth tag is NOT included in the output (Node.js/Python/PHP all omit getAuthTag/digest)
     *   - Key: raw UTF-8 bytes of the key string (secretKey.getBytes(StandardCharsets.UTF_8))
     *
     * To strip the tag in Java: doFinal() appends 16 bytes of auth tag → we remove the last 16 bytes.
     */
    public static String encrypt(String secretKey, String payload) throws Exception {
        if (payload == null) payload = "";

        byte[] keyBytes = resolveKeyBytes(secretKey);
        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");

        byte[] iv = new byte[IV_LENGTH];  // 16 bytes, per BuckBox spec
        new SecureRandom().nextBytes(iv);

        // Apply manual PKCS7 padding (matches Python sample: pad(payload.encode("utf-8")))
        byte[] paddedPlaintext = pad(payload.getBytes(StandardCharsets.UTF_8), 16);

        // Encrypt with AES-GCM. Java appends a 16-byte auth tag to doFinal() output.
        // BuckBox does NOT include the tag → strip the last 16 bytes (TAG_LENGTH_BIT/8 = 16).
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
        byte[] encryptedWithTag = cipher.doFinal(paddedPlaintext);

        // Strip the 16-byte auth tag appended by Java — provider does not expect it
        int ciphertextLen = encryptedWithTag.length - (TAG_LENGTH_BIT / 8);
        byte[] ciphertext = Arrays.copyOfRange(encryptedWithTag, 0, ciphertextLen);

        // Output: Base64(IV[16] + ciphertext)
        ByteBuffer combined = ByteBuffer.allocate(iv.length + ciphertext.length);
        combined.put(iv);
        combined.put(ciphertext);
        log.debug("[BusttoCrypto] encrypt: IV={} bytes, plaintext={} bytes, padded={} bytes, ciphertext={} bytes, key={} bytes",
            iv.length, payload.length(), paddedPlaintext.length, ciphertext.length, keyBytes.length);
        return Base64.getEncoder().encodeToString(combined.array());
    }

    /**
     * Decrypts the Base64-encoded response from BuckBox.
     *
     * BuckBox format:  Base64( IV[16 bytes] + ciphertext-WITHOUT-auth-tag )
     *
     * Since there is NO auth tag in the ciphertext, AES/GCM/NoPadding decryption CANNOT be used
     * (it would always fail MAC check because there's no tag to verify). Instead, we use the
     * mathematically equivalent approach: AES/CTR starting from counter Y1 = increment(J0),
     * where J0 = GHASH_H(IV) for a 16-byte IV (the GCM internal counter block).
     *
     * This is identical to what the provider does: GCM encryption = CTR(Y1) XOR plaintext.
     */
    public static String decrypt(String secretKey, String encrypted) throws Exception {
        if (encrypted == null || encrypted.isBlank()) return "";

        byte[] all = Base64.getDecoder().decode(encrypted.trim());
        if (all.length <= IV_LENGTH) {
            throw new IllegalArgumentException(
                "AES decryption failed: payload too short (" + all.length + " bytes). " +
                "Minimum expected: IV(" + IV_LENGTH + ") + ciphertext.");
        }

        byte[] iv         = Arrays.copyOfRange(all, 0, IV_LENGTH);
        byte[] ciphertext = Arrays.copyOfRange(all, IV_LENGTH, all.length);

        byte[] keyBytes = resolveKeyBytes(secretKey);
        log.debug("[BusttoCrypto] decrypt: payload={} bytes, IV={} bytes, ciphertext={} bytes, key={} bytes",
            all.length, iv.length, ciphertext.length, keyBytes.length);

        try {
            // BuckBox uses GCM without auth tag = CTR mode starting at counter Y1.
            // For a 16-byte IV: J0 = GHASH(H, {}, IV), Y1 = increment32(J0).
            byte[] y0 = calculateY0(keyBytes, iv);
            byte[] y1 = incrementY(y0);

            Cipher cipher = Cipher.getInstance("AES/CTR/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new IvParameterSpec(y1));
            byte[] decrypted = cipher.doFinal(ciphertext);

            // Remove PKCS7 padding applied before encryption (Python sample uses pad/unpad)
            byte[] unpadded = unpad(decrypted);
            return new String(unpadded, StandardCharsets.UTF_8);

        } catch (Exception e) {
            log.error("[BusttoCrypto] AES decryption failed: {}. " +
                "Verify BUSTTO_AES_KEY matches the Encryption Key in your BuckBox merchant portal.",
                e.getMessage());
            throw new RuntimeException("AES decryption failed: " + e.getMessage(), e);
        }
    }
}
