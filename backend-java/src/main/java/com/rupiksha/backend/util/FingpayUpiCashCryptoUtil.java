package com.rupiksha.backend.util;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.crypto.engines.AESEngine;
import org.bouncycastle.crypto.paddings.PKCS7Padding;
import org.bouncycastle.crypto.paddings.PaddedBufferedBlockCipher;
import org.bouncycastle.crypto.params.KeyParameter;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Security;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Base64;

/**
 * Official Fingpay UPI Cash Withdrawal (UPICW) Cryptographic Utility.
 * Implements the official Fingpay specification for:
 * 1. 128-bit AES session key generation
 * 2. RSA public-key session key encryption (eskey)
 * 3. AES-128 session key payload encryption
 * 4. SHA-256 Base64 hash header computation (JSON + "@" + secretKey)
 * 5. MD5 merchant PIN hashing
 */
@Slf4j
@Component
public class FingpayUpiCashCryptoUtil {

    private static final String JCE_PROVIDER = "BC";
    private static final int SYMMETRIC_KEY_SIZE = 128;
    private static final DateTimeFormatter TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    static {
        if (Security.getProvider(JCE_PROVIDER) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    @Value("${fingpay.upicw.public-key-path:${fingpay.public.key.path:classpath:fingpay.cer}}")
    private Resource certFile;

    @Value("${fingpay.upicw.rsa-transformation:RSA/ECB/OAEPWithMD5AndMGF1Padding}")
    private String primaryRsaTransformation = "RSA/ECB/OAEPWithMD5AndMGF1Padding";

    private PublicKey publicKey;

    @PostConstruct
    public void init() {
        try {
            if (certFile != null && certFile.exists()) {
                try (InputStream inStream = certFile.getInputStream()) {
                    CertificateFactory cf = CertificateFactory.getInstance("X.509");
                    Certificate cert = cf.generateCertificate(inStream);
                    publicKey = cert.getPublicKey();
                    log.info("Fingpay UPI Cash Point public certificate loaded successfully from: {}", certFile.getDescription());
                }
            } else {
                log.warn("Fingpay certificate file resource not found at specified path");
            }
        } catch (Exception e) {
            log.error("Failed to load Fingpay public certificate: {}", e.getMessage(), e);
        }
    }

    /**
     * Generates a cryptographically secure 128-bit AES session key.
     */
    public byte[] generateSessionKey() throws Exception {
        KeyGenerator kgen = KeyGenerator.getInstance("AES", JCE_PROVIDER);
        kgen.init(SYMMETRIC_KEY_SIZE, new SecureRandom());
        return kgen.generateKey().getEncoded();
    }

    /**
     * Encrypts the AES session key using the Fingpay public certificate.
     * Uses RSA/ECB/OAEPWithMD5AndMGF1Padding (Java/.NET specification) with graceful
     * fallback to RSA/ECB/PKCS1Padding if required by the target environment.
     */
    public String encryptSessionKey(byte[] sessionKey) throws Exception {
        if (publicKey == null) {
            throw new IllegalStateException("Fingpay public key is not loaded");
        }

        SecureRandom secureRandom = new SecureRandom();
        Cipher cipher;
        try {
            cipher = Cipher.getInstance(primaryRsaTransformation, JCE_PROVIDER);
            cipher.init(Cipher.ENCRYPT_MODE, publicKey, secureRandom);
            byte[] ciphertextBytes = cipher.doFinal(sessionKey);
            return Base64.getEncoder().encodeToString(ciphertextBytes).replace("\r\n", "").replace("\n", "");
        } catch (Exception primaryEx) {
            log.warn("Primary RSA transformation {} failed ({}), attempting fallback RSA/ECB/PKCS1Padding",
                    primaryRsaTransformation, primaryEx.getMessage());
            cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding", JCE_PROVIDER);
            cipher.init(Cipher.ENCRYPT_MODE, publicKey, secureRandom);
            byte[] fallbackBytes = cipher.doFinal(sessionKey);
            return Base64.getEncoder().encodeToString(fallbackBytes).replace("\r\n", "").replace("\n", "");
        }
    }

    /**
     * Encrypts the JSON payload bytes using the AES-128 session key and PKCS7 padding.
     * Matches the official Java/.NET implementation in the Fingpay specification guide:
     * PaddedBufferedBlockCipher(new AESEngine(), new PKCS7Padding())
     */
    public String encryptPayload(byte[] sessionKey, byte[] payloadData) throws Exception {
        PaddedBufferedBlockCipher cipher = new PaddedBufferedBlockCipher(new AESEngine(), new PKCS7Padding());
        cipher.init(true, new KeyParameter(sessionKey));

        int outputSize = cipher.getOutputSize(payloadData.length);
        byte[] tempOP = new byte[outputSize];
        int processLen = cipher.processBytes(payloadData, 0, payloadData.length, tempOP, 0);
        int outputLen = cipher.doFinal(tempOP, processLen);

        byte[] result = new byte[processLen + outputLen];
        result = Arrays.copyOf(tempOP, result.length);

        return Base64.getEncoder().encodeToString(result).replace("\r\n", "").replace("\n", "");
    }

    /**
     * Decrypts an encrypted payload using the AES-128 session key (for testing and verification).
     */
    public String decryptPayload(byte[] sessionKey, String base64Encrypted) throws Exception {
        byte[] cipherData = Base64.getDecoder().decode(base64Encrypted);
        PaddedBufferedBlockCipher cipher = new PaddedBufferedBlockCipher(new AESEngine(), new PKCS7Padding());
        cipher.init(false, new KeyParameter(sessionKey));

        int outputSize = cipher.getOutputSize(cipherData.length);
        byte[] tempOP = new byte[outputSize];
        int processLen = cipher.processBytes(cipherData, 0, cipherData.length, tempOP, 0);
        int outputLen = cipher.doFinal(tempOP, processLen);

        byte[] result = Arrays.copyOf(tempOP, processLen + outputLen);
        return new String(result, StandardCharsets.UTF_8);
    }

    /**
     * Computes the official Fingpay hash header:
     * Step 1: Request JSON
     * Step 2: Append Secret Key with "@": Request JSON + "@" + Secret Key
     * Step 3: SHA-256 digest
     * Step 4: Base64 encode
     */
    public String generateHash(String jsonPayload, String secretKey) {
        try {
            String input = jsonPayload + "@" + secretKey;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest).replace("\r\n", "").replace("\n", "");
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 hash generation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Validates incoming hash against computed hash in constant time to prevent timing attacks.
     */
    public boolean verifyHash(String jsonPayload, String secretKey, String receivedHash) {
        if (receivedHash == null || receivedHash.isBlank()) {
            return false;
        }
        String cleanExpected = generateHash(jsonPayload, secretKey).trim();
        String cleanReceived = receivedHash.trim();
        return MessageDigest.isEqual(cleanExpected.getBytes(StandardCharsets.UTF_8), cleanReceived.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Generates MD5 hash of merchant login PIN (lowercase hexadecimal 32 chars).
     */
    public String md5(String pin) {
        if (pin == null) return "";
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(pin.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("MD5 PIN computation failed", e);
        }
    }

    /**
     * Current transaction timestamp in the mandatory Fingpay format (dd/MM/yyyy HH:mm:ss).
     */
    public String currentTimestamp() {
        return LocalDateTime.now().format(TIMESTAMP_FORMATTER);
    }

    public PublicKey getPublicKey() {
        return publicKey;
    }

    public void setPublicKey(PublicKey publicKey) {
        this.publicKey = publicKey;
    }
}
