package com.rupiksha.aeps.util;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class BusttoCryptoUtilTest {
    private static final Logger log = LoggerFactory.getLogger(BusttoCryptoUtilTest.class);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Round-trip: standard 32-char UTF-8 key
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void roundTrip_standard32CharKey() throws Exception {
        String key     = "12345678901234567890123456789012"; // 32 ASCII chars = 32 bytes
        String payload = "{\"amount\": 100, \"currency\": \"INR\"}";

        String encrypted = BusttoCryptoUtil.encrypt(key, payload);
        assertNotNull(encrypted);
        assertFalse(encrypted.isBlank());

        // Verify minimum length: IV (16) + TAG (16) + Ciphertext > 32 bytes
        byte[] raw = Base64.getDecoder().decode(encrypted);
        assertTrue(raw.length >= 32, "Raw encrypted payload must have at least 32 bytes (IV + Tag)");

        String decrypted = BusttoCryptoUtil.decrypt(key, encrypted);
        assertEquals(payload, decrypted, "Round-trip must yield original payload");
        log.info("[TEST] 32-char key round-trip: PASS");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Round-trip: Base64-encoded 32-byte key (standard BuckBox / PHP format)
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void roundTrip_base64Encoded32ByteKey() throws Exception {
        // Generate a random 32-byte key and Base64 encode it (44 chars with =)
        byte[] rawKey = new byte[32];
        new SecureRandom().nextBytes(rawKey);
        String base64Key = Base64.getEncoder().encodeToString(rawKey);
        assertEquals(44, base64Key.length());

        byte[] resolved = BusttoCryptoUtil.resolveKeyBytes(base64Key);
        assertEquals(32, resolved.length, "Base64 key must resolve to 32 bytes");
        assertArrayEquals(rawKey, resolved);

        String payload = "{\"amount\": 100, \"external_order_id\": \"PO_12345\"}";
        String encrypted = BusttoCryptoUtil.encrypt(base64Key, payload);
        String decrypted = BusttoCryptoUtil.decrypt(base64Key, encrypted);
        assertEquals(payload, decrypted);
        log.info("[TEST] Base64-encoded 32-byte key round-trip: PASS");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Round-trip: URL-safe Base64 key (with '-' and '_')
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void roundTrip_urlSafeBase64Key() throws Exception {
        byte[] rawKey = new byte[32];
        new SecureRandom().nextBytes(rawKey);
        String urlSafeKey = Base64.getUrlEncoder().withoutPadding().encodeToString(rawKey);

        byte[] resolved = BusttoCryptoUtil.resolveKeyBytes(urlSafeKey);
        assertEquals(32, resolved.length, "URL-safe Base64 key must resolve to 32 bytes");
        assertArrayEquals(rawKey, resolved);

        String payload = "{\"amount\": 500, \"bene_name\": \"ANUJ\"}";
        String encrypted = BusttoCryptoUtil.encrypt(urlSafeKey, payload);
        String decrypted = BusttoCryptoUtil.decrypt(urlSafeKey, encrypted);
        assertEquals(payload, decrypted);
        log.info("[TEST] URL-safe Base64 key round-trip: PASS");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Verification that GCM Auth Tag is checked: wrong key throws exception
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void decrypt_wrongKey_failsGcmAuthCheck() throws Exception {
        String correctKey = "CorrectKey123456CorrectKey123456"; // 32 chars
        String wrongKey   = "WrongKey1234567890WrongKey123456"; // 32 chars

        String payload   = "{\"amount\": 100}";
        String encrypted = BusttoCryptoUtil.encrypt(correctKey, payload);

        // In GCM mode, decrypting with wrong key MUST fail auth tag verification
        assertThrows(RuntimeException.class, () -> BusttoCryptoUtil.decrypt(wrongKey, encrypted),
                "AES-GCM decryption with wrong key must fail MAC / tag verification");
        log.info("[TEST] Wrong-key GCM auth failure: PASS");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Interoperability test: External format decrypted by Java
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void providerInteroperability_decryptExternalFormat() throws Exception {
        byte[] rawKey = "12345678901234567890123456789012".getBytes(StandardCharsets.UTF_8);
        String base64Key = Base64.getEncoder().encodeToString(rawKey);

        String payload = "{\"bbStatusCode\":0,\"bbStatusMsg\":\"SUCCESS\",\"TransactionData\":{\"bbTransactionId\":\"TXN123\"}}";

        // Emulate external provider AES-256-GCM output format: Base64( iv + tag + cipher )
        byte[] iv = new byte[16];
        new SecureRandom().nextBytes(iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(rawKey, "AES"), new GCMParameterSpec(128, iv));
        byte[] cipherAndTag = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));

        int cipherLen = cipherAndTag.length - 16;
        byte[] ciphertext = Arrays.copyOfRange(cipherAndTag, 0, cipherLen);
        byte[] tag = Arrays.copyOfRange(cipherAndTag, cipherLen, cipherAndTag.length);

        ByteBuffer output = ByteBuffer.allocate(16 + 16 + cipherLen);
        output.put(iv);
        output.put(tag);
        output.put(ciphertext);
        String encryptedBase64 = Base64.getEncoder().encodeToString(output.array());

        // Java decrypt must successfully decrypt provider output
        String decrypted = BusttoCryptoUtil.decrypt(base64Key, encryptedBase64);
        assertEquals(payload, decrypted, "Java must decrypt provider-formatted AES-GCM output");
        log.info("[TEST] Provider interoperability decrypt test: PASS");
    }
}
