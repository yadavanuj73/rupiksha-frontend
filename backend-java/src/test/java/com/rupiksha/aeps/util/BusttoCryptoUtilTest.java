package com.rupiksha.aeps.util;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.junit.jupiter.api.Assertions.*;

class BusttoCryptoUtilTest {
    private static final Logger log = LoggerFactory.getLogger(BusttoCryptoUtilTest.class);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Round-trip: standard 32-char UTF-8 key (the normal BuckBox case)
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void roundTrip_standard32CharKey() throws Exception {
        String key     = "12345678901234567890123456789012"; // 32 ASCII chars = 32 bytes
        String payload = "{\"amount\": 100, \"currency\": \"INR\"}";

        String encrypted = BusttoCryptoUtil.encrypt(key, payload);
        assertNotNull(encrypted);
        assertFalse(encrypted.isBlank());

        String decrypted = BusttoCryptoUtil.decrypt(key, encrypted);
        assertEquals(payload, decrypted, "Round-trip must yield original payload");
        log.info("[TEST] 32-char key round-trip: PASS");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Key size: 32-char ASCII key must resolve to exactly 32 bytes (AES-256)
    //    Before the fix: resolveKeyBytes() incorrectly hex-decoded it to 16 bytes.
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void keyResolution_32charAsciiKey_mustBe32Bytes() {
        // A key that looks hex-like — this was the exact trigger of the bug.
        // Old code: matched hex regex → decoded to 16 bytes (AES-128) → key mismatch → MAC check failed
        // Fixed code: UTF-8 check runs first → 32 bytes returned unchanged (AES-256)
        String key = "12345678901234567890123456789012"; // 32 chars, all digits
        byte[] keyBytes = BusttoCryptoUtil.resolveKeyBytes(key);
        assertEquals(32, keyBytes.length,
            "A 32-character ASCII key must resolve to exactly 32 bytes (AES-256). " +
            "If this fails, the hex/base64 fallback is incorrectly running before the UTF-8 check.");
        log.info("[TEST] 32-char ASCII key → {} bytes (expected 32): PASS", keyBytes.length);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Key size: 24-char ASCII key must resolve to exactly 24 bytes (AES-192)
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void keyResolution_24charAsciiKey_mustBe24Bytes() {
        String key = "123456789012345678901234"; // 24 chars
        byte[] keyBytes = BusttoCryptoUtil.resolveKeyBytes(key);
        assertEquals(24, keyBytes.length,
            "A 24-character ASCII key must resolve to exactly 24 bytes (AES-192).");
        log.info("[TEST] 24-char ASCII key → {} bytes (expected 24): PASS", keyBytes.length);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Key size: 16-char ASCII key must resolve to exactly 16 bytes (AES-128)
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void keyResolution_16charAsciiKey_mustBe16Bytes() {
        String key = "1234567890123456"; // 16 chars
        byte[] keyBytes = BusttoCryptoUtil.resolveKeyBytes(key);
        assertEquals(16, keyBytes.length,
            "A 16-character ASCII key must resolve to exactly 16 bytes (AES-128).");
        log.info("[TEST] 16-char ASCII key → {} bytes (expected 16): PASS", keyBytes.length);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Round-trip with a mixed alphanumeric 32-char key (realistic merchant key)
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void roundTrip_mixedAlphanumeric32charKey() throws Exception {
        String key     = "aBcDeFgH1234567890aBcDeFgH123456"; // 32 chars mixed
        String payload = "{\"amount\": \"100\", \"external_order_id\": \"PO_TEST_001\"}";

        byte[] keyBytes = BusttoCryptoUtil.resolveKeyBytes(key);
        assertEquals(32, keyBytes.length, "Mixed 32-char key must be 32 bytes");

        String encrypted = BusttoCryptoUtil.encrypt(key, payload);
        String decrypted = BusttoCryptoUtil.decrypt(key, encrypted);
        assertEquals(payload, decrypted, "Round-trip must yield original payload");
        log.info("[TEST] Mixed 32-char key round-trip: PASS");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. BuckBox does NOT use the GCM auth tag (confirmed by all their sample codes —
    //    Node.js/Python/PHP all omit getAuthTag/digest). This means decryption uses
    //    AES/CTR which has NO integrity check. Wrong-key decryption produces garbage
    //    plaintext (does not throw). We verify the garbage != original plaintext.
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void decrypt_wrongKey_producesGarbage_notOriginalPayload() throws Exception {
        String correctKey = "CorrectKey123456CorrectKey123456"; // 32 chars
        String wrongKey   = "WrongKey1234567890WrongKey123456"; // 32 chars

        String payload   = "{\"amount\": 100}";
        String encrypted = BusttoCryptoUtil.encrypt(correctKey, payload);

        // CTR mode has no auth tag → wrong-key decryption does NOT throw but returns garbage
        String wrongDecrypted = BusttoCryptoUtil.decrypt(wrongKey, encrypted);
        assertNotEquals(payload, wrongDecrypted,
            "Wrong-key decryption must not return the original plaintext — output should be garbage");
        log.info("[TEST] Wrong-key decryption produces garbage (not original payload): PASS");
        log.info("[TEST] BuckBox design note: no GCM auth tag means no built-in integrity check");
    }


    // ─────────────────────────────────────────────────────────────────────────
    // 7. Hex-encoded key (64 hex chars) should still be decoded correctly
    //    via the hex fallback path (this is a valid edge case)
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void keyResolution_64charHexKey_mustBe32Bytes() {
        // 64 hex chars = 32 raw bytes — the hex-encoded form of an AES-256 key
        String key = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
        byte[] keyBytes = BusttoCryptoUtil.resolveKeyBytes(key);
        assertEquals(32, keyBytes.length,
            "A 64-char hex-encoded key must decode to 32 bytes via the hex fallback.");
        log.info("[TEST] 64-char hex key → {} bytes (expected 32): PASS", keyBytes.length);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Environment variable config inspector (safe — only logs lengths)
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    void inspectEnvironmentConfig() {
        log.info("=========================================");
        log.info("Checking for BUSTTO_AES_KEY in environment:");
        String envKey = System.getenv("BUSTTO_AES_KEY");
        if (envKey == null) {
            log.info("  BUSTTO_AES_KEY = NOT SET (will use empty default in dev)");
        } else if (envKey.isBlank()) {
            log.info("  BUSTTO_AES_KEY = EMPTY STRING");
        } else {
            log.info("  BUSTTO_AES_KEY raw length: {} characters", envKey.length());
            byte[] resolved = BusttoCryptoUtil.resolveKeyBytes(envKey);
            log.info("  BUSTTO_AES_KEY resolved byte length: {} bytes", resolved.length);
            log.info("  Expected for AES-256: 32 bytes");
            if (resolved.length != 32) {
                log.warn("  WARNING: Key resolves to {} bytes, not 32. Provider uses AES-256 (32 bytes).", resolved.length);
            }
        }
        log.info("=========================================");
    }
}
