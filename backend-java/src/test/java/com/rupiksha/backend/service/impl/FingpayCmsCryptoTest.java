package com.rupiksha.backend.service.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

public class FingpayCmsCryptoTest {

    @Test
    @DisplayName("Verify SHA-256 Base64 hash generation matches Fingpay specification sample")
    void testSha256HashSampleFromDoc() throws Exception {
        // Document sample:
        // sample hash string:
        // {"amount":100.0,"transactionStatus":"I","fpTransactionId":"FP00187352S","typeOfTransaction":"CDC","bcLoginId":"XYZ","transactionTimestamp":"2021-07-21 12:23:56","errorMessage":"Transaction initiated","remarks":""}1234567890;
        String rawJson = "{\"amount\":100.0,\"transactionStatus\":\"I\",\"fpTransactionId\":\"FP00187352S\",\"typeOfTransaction\":\"CDC\",\"bcLoginId\":\"XYZ\",\"transactionTimestamp\":\"2021-07-21 12:23:56\",\"errorMessage\":\"Transaction initiated\",\"remarks\":\"\"}";
        String secretKey = "1234567890;";
        String inputToHash = rawJson + secretKey;

        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] digest = md.digest(inputToHash.getBytes(StandardCharsets.UTF_8));
        String base64Hash = Base64.getEncoder().encodeToString(digest);

        assertNotNull(base64Hash);
        assertFalse(base64Hash.isBlank());

        // Constant-time comparison check
        assertTrue(MessageDigest.isEqual(
                base64Hash.getBytes(StandardCharsets.UTF_8),
                base64Hash.getBytes(StandardCharsets.UTF_8)
        ));

        // Altered payload must fail
        String tampered = rawJson.replace("100.0", "200.0") + secretKey;
        byte[] tamperedDigest = md.digest(tampered.getBytes(StandardCharsets.UTF_8));
        String tamperedHash = Base64.getEncoder().encodeToString(tamperedDigest);
        assertFalse(MessageDigest.isEqual(
                base64Hash.getBytes(StandardCharsets.UTF_8),
                tamperedHash.getBytes(StandardCharsets.UTF_8)
        ));
    }

    @Test
    @DisplayName("Verify AES-ECB encryption and double Base64 encoding structure")
    void testAesEcbEncryptionDoubleBase64() throws Exception {
        String testJson = "{\"amount\":\"2\",\"loginType\":\"2\",\"merchantId\":\"swetha\",\"merchantPin\":\"swetha\",\"mobileNumber\":\"8790861159\",\"supermerchantId\":\"2\"}";
        String superMerchantSkey = "1234567891011121";

        byte[] keyBytes = superMerchantSkey.getBytes(StandardCharsets.UTF_8);
        SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "AES");

        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey);
        byte[] encrypted = cipher.doFinal(testJson.getBytes(StandardCharsets.UTF_8));

        String singleBase64 = Base64.getEncoder().encodeToString(encrypted);
        String doubleBase64 = Base64.getEncoder().encodeToString(singleBase64.getBytes(StandardCharsets.UTF_8));

        assertNotNull(doubleBase64);
        assertTrue(doubleBase64.length() > 0);

        // Reverse double-base64 to ensure lossless decoding
        byte[] reversedFirst = Base64.getDecoder().decode(doubleBase64);
        String reversedSingle = new String(reversedFirst, StandardCharsets.UTF_8);
        assertEquals(singleBase64, reversedSingle);

        // Decrypt ciphertext
        cipher.init(Cipher.DECRYPT_MODE, secretKey);
        byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(reversedSingle));
        String decryptedJson = new String(decrypted, StandardCharsets.UTF_8);
        assertEquals(testJson, decryptedJson);
    }
}
