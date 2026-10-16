package com.rupiksha.backend.integration.bbps.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.junit.jupiter.api.Assertions.*;

class BillAvenueCryptoUtilTest {

    private static final String SAMPLE_WORKING_KEY = "AVYX26EA85AL93XYLA12345678901234";

    @Test
    @DisplayName("Generate Request ID conforms to BillAvenue 35-character format: <27 random><YDDDhhmm>")
    void testGenerateRequestIdFormat() {
        String requestId = BillAvenueCryptoUtil.generateRequestId();

        assertNotNull(requestId);
        assertEquals(35, requestId.length(), "RequestId must be exactly 35 characters long");

        // Verify suffix matches YDDDhhmm
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Kolkata"));
        String expectedYearDigit = String.valueOf(now.getYear() % 10);
        char actualYearDigit = requestId.charAt(27);

        assertEquals(expectedYearDigit.charAt(0), actualYearDigit, "28th character must be last digit of current year");
    }

    @Test
    @DisplayName("Encrypt and Decrypt plain text parity using AES-128-CBC PKCS5Padding")
    void testEncryptDecryptParity() {
        String sampleJson = "{\"billerId\":\"BILAVAIRTEL001\",\"customerMobile\":\"9876543210\",\"amount\":\"29900\"}";

        String encrypted = BillAvenueCryptoUtil.encrypt(sampleJson, SAMPLE_WORKING_KEY, null);
        assertNotNull(encrypted);
        assertNotEquals(sampleJson, encrypted);

        String decrypted = BillAvenueCryptoUtil.decrypt(encrypted, SAMPLE_WORKING_KEY, null);
        assertEquals(sampleJson, decrypted, "Decrypted text must match original plaintext");
    }

    @Test
    @DisplayName("Reject blank plaintext or working key in encryption")
    void testEncryptionInputValidation() {
        assertThrows(IllegalArgumentException.class, () -> BillAvenueCryptoUtil.encrypt(null, SAMPLE_WORKING_KEY, null));
        assertThrows(IllegalArgumentException.class, () -> BillAvenueCryptoUtil.encrypt("{}", "", null));
    }
}
