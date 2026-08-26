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
        log.info("[BusttoCrypto] AES key length = {} bytes (UTF-8). Valid AES sizes: 16, 24, 32.", utfBytes.length);
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
     * Encrypts the raw JSON payload with the merchant AES secret key using GCM mode.
     * Matches BuckBox Python/Node.js/PHP GCM implementation (no GCM tag appended).
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
        
        // Output format is: iv (16 bytes) + ciphertext (without tag)
        // Standard GCM doFinal appends a 16-byte tag. We slice off the last 16 bytes.
        int ciphertextLen = encryptedWithTag.length - 16;
        byte[] ciphertext = new byte[ciphertextLen];
        System.arraycopy(encryptedWithTag, 0, ciphertext, 0, ciphertextLen);

        ByteBuffer combined = ByteBuffer.allocate(iv.length + ciphertext.length);
        combined.put(iv);
        combined.put(ciphertext);
        return Base64.getEncoder().encodeToString(combined.array());
    }

    /**
     * Decrypts the Base64-encoded encrypted payload returned from BuckBox/Bustto.
     * Tries GCM decryption without tag checking (by computing counter Y_1 and using AES/CTR/NoPadding),
     * and has other modes as fallback.
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

        // Attempt 1: Custom GCM without tag check (mathematically identical to AES/CTR/NoPadding starting from Y_1)
        try {
            byte[] y0 = calculateY0(keyBytes, iv);
            byte[] y1 = incrementY(y0);

            Cipher cipher = Cipher.getInstance("AES/CTR/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(y1));
            byte[] decrypted = cipher.doFinal(cipherBytes);

            byte[] unpadded = unpad(decrypted);
            return new String(unpadded, StandardCharsets.UTF_8);
        } catch (Exception e1) {
            log.debug("Custom GCM without tag check decryption failed: {}, trying other modes", e1.getMessage());
        }

        // Attempt 2: AES/CBC/PKCS5Padding fallback
        try {
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e2) {
            log.debug("CBC PKCS5 decryption fallback failed: {}", e2.getMessage());
        }

        // Attempt 3: AES/GCM/NoPadding with 128-bit tag fallback (standard GCM with auth tag)
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e3) {
            log.debug("GCM 128-bit decryption fallback failed: {}", e3.getMessage());
        }

        // Attempt 4: AES/CTR/NoPadding with standard IV fallback
        try {
            Cipher cipher = Cipher.getInstance("AES/CTR/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
            byte[] decrypted = cipher.doFinal(cipherBytes);
            byte[] unpadded = unpad(decrypted);
            return new String(unpadded, StandardCharsets.UTF_8);
        } catch (Exception e4) {
            throw new RuntimeException("All decryption modes failed for payload", e4);
        }
    }
}
