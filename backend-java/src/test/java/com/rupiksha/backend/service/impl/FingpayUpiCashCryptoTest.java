package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.util.FingpayUpiCashCryptoUtil;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Security;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

public class FingpayUpiCashCryptoTest {

    private static FingpayUpiCashCryptoUtil cryptoUtil;
    private static KeyPair testRsaKeyPair;

    @BeforeAll
    static void setUp() throws Exception {
        if (Security.getProvider("BC") == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        cryptoUtil = new FingpayUpiCashCryptoUtil();

        // Generate RSA-2048 keypair for cryptographic testing
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA", "BC");
        kpg.initialize(2048);
        testRsaKeyPair = kpg.generateKeyPair();
        cryptoUtil.setPublicKey(testRsaKeyPair.getPublic());
    }

    @Test
    @DisplayName("Verify 128-bit AES session key generation")
    void testSessionKeyGeneration() throws Exception {
        byte[] sessionKey = cryptoUtil.generateSessionKey();
        assertNotNull(sessionKey);
        assertEquals(16, sessionKey.length, "Session key must be 128 bits (16 bytes)");
    }

    @Test
    @DisplayName("Verify RSA session key encryption produces Base64 eskey header")
    void testRsaSessionKeyEncryption() throws Exception {
        byte[] sessionKey = cryptoUtil.generateSessionKey();
        String eskey = cryptoUtil.encryptSessionKey(sessionKey);

        assertNotNull(eskey);
        assertFalse(eskey.isBlank());
        assertFalse(eskey.contains("\r"));
        assertFalse(eskey.contains("\n"));

        // Verify it is valid Base64
        byte[] decoded = Base64.getDecoder().decode(eskey);
        assertTrue(decoded.length > 0);
    }

    @Test
    @DisplayName("Verify AES-128 session key payload encryption and decryption roundtrip")
    void testAesPayloadEncryptionRoundtrip() throws Exception {
        byte[] sessionKey = cryptoUtil.generateSessionKey();
        String sampleJson = "{\"bcLoginId\":\"radhika\",\"bcLoginPin\":\"f925916e2754e5e03f75dd58a5733251\",\"amount\":\"100.00\",\"bcLatitude\":17.385044,\"bcLongitude\":78.486671,\"partnerRequestId\":\"TXN20260608143019\",\"transactionType\":\"UPICW\"}";

        String encryptedBase64 = cryptoUtil.encryptPayload(sessionKey, sampleJson.getBytes(StandardCharsets.UTF_8));
        assertNotNull(encryptedBase64);
        assertNotEquals(sampleJson, encryptedBase64);

        String decrypted = cryptoUtil.decryptPayload(sessionKey, encryptedBase64);
        assertEquals(sampleJson, decrypted, "Decrypted payload must match original JSON");
    }

    @Test
    @DisplayName("Verify SHA-256 hash generation with @ separator matching official Fingpay document")
    void testSha256HashWithAtSeparator() {
        String jsonPayload = "{\"fingpayTxnId\":\"00000QCWG146594970605JC2515176\",\"partnerRequestId\":\"ctxn059\"}";
        String secretKey = "test_secret_key";

        String hash = cryptoUtil.generateHash(jsonPayload, secretKey);
        assertNotNull(hash);

        // Compute expected hash manually
        String expectedInput = jsonPayload + "@" + secretKey;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(expectedInput.getBytes(StandardCharsets.UTF_8));
            String expectedHash = Base64.getEncoder().encodeToString(digest);
            assertEquals(expectedHash, hash);
            assertTrue(cryptoUtil.verifyHash(jsonPayload, secretKey, hash));
        } catch (Exception e) {
            fail("Exception computing manual digest: " + e.getMessage());
        }

        // Altered payload must fail constant-time verification
        assertFalse(cryptoUtil.verifyHash(jsonPayload.replace("ctxn059", "ctxn060"), secretKey, hash));
        assertFalse(cryptoUtil.verifyHash(jsonPayload, "wrong_secret", hash));
    }

    @Test
    @DisplayName("Verify MD5 PIN hashing produces 32-character lowercase hex string")
    void testMd5PinHashing() {
        String pin = "1234";
        String md5 = cryptoUtil.md5(pin);
        assertNotNull(md5);
        assertEquals(32, md5.length());
        assertEquals("81dc9bdb52d04dc20036dbd8313ed055", md5);
    }
}
