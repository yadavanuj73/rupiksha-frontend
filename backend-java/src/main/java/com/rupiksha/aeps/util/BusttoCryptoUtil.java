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

    private static final String ALGO_GCM = "AES/GCM/NoPadding";
    private static final String ALGO_GCM_PKCS5 = "AES/GCM/PKCS5Padding";
    private static final int IV_LENGTH = 16;
    private static final int TAG_LENGTH_BIT = 128;

    /**
     * Encrypts the raw JSON payload with the merchant AES secret key.
     * Uses a 16-byte random IV, prepends IV to ciphertext, and Base64-encodes the result.
     */
    public static String encrypt(String secretKey, String payload) throws Exception {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalArgumentException("AES secret key is missing");
        }
        if (payload == null) {
            payload = "";
        }

        byte[] keyBytes = secretKey.getBytes(StandardCharsets.UTF_8);
        SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");
        
        byte[] iv = new byte[IV_LENGTH];
        SecureRandom random = new SecureRandom();
        random.nextBytes(iv);

        Cipher cipher;
        try {
            cipher = Cipher.getInstance(ALGO_GCM_PKCS5);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new IvParameterSpec(iv));
        } catch (Exception e) {
            // Fallback for JVMs that expect GCMParameterSpec
            cipher = Cipher.getInstance(ALGO_GCM);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
        }

        byte[] encrypted = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));

        ByteBuffer combined = ByteBuffer.allocate(iv.length + encrypted.length);
        combined.put(iv);
        combined.put(encrypted);

        return Base64.getEncoder().encodeToString(combined.array());
    }

    /**
     * Decrypts the Base64-encoded encrypted payload returned from the API.
     */
    public static String decrypt(String secretKey, String encrypted) throws Exception {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalArgumentException("AES secret key is missing");
        }
        if (encrypted == null || encrypted.isBlank()) {
            return "";
        }

        byte[] all = Base64.getDecoder().decode(encrypted.trim());
        if (all.length < IV_LENGTH) {
            throw new IllegalArgumentException("Invalid encrypted payload length");
        }

        byte[] iv = Arrays.copyOfRange(all, 0, IV_LENGTH);
        byte[] cipherBytes = Arrays.copyOfRange(all, IV_LENGTH, all.length);

        SecretKeySpec keySpec = new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "AES");

        Cipher cipher;
        try {
            cipher = Cipher.getInstance(ALGO_GCM_PKCS5);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
        } catch (Exception e) {
            cipher = Cipher.getInstance(ALGO_GCM);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BIT, iv));
        }

        byte[] decrypted = cipher.doFinal(cipherBytes);
        return new String(decrypted, StandardCharsets.UTF_8);
    }
}
