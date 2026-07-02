package com.rupiksha.aeps.provider.fingpay.util;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

@Component
@Slf4j
public class FingpayEncryptionUtil {

    @Value("${fingpay.public.key.path}")
    private Resource certFile;

    private PublicKey publicKey;

    @PostConstruct
    public void init() throws Exception {

        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        Certificate cert = cf.generateCertificate(certFile.getInputStream());
        publicKey = cert.getPublicKey();

        log.info("✅ Fingpay Public Key Loaded Successfully");
    }

    // ⭐ AES SESSION KEY GENERATE
    public SecretKey generateSessionKey() throws Exception {

        KeyGenerator kg = KeyGenerator.getInstance("AES");
        kg.init(128);
        return kg.generateKey();
    }

    // ⭐ BODY ENCRYPTION (ECB MODE — REQUIRED FOR ONBOARDING)
    public String encryptBody(String json, SecretKey key) throws Exception {

        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, key);

        byte[] encrypted = cipher.doFinal(json.getBytes(StandardCharsets.UTF_8));

        return Base64.getEncoder().encodeToString(encrypted);
    }

    // ⭐ SESSION KEY ENCRYPTION USING FINGPAY PUBLIC KEY
    public String encryptSessionKey(SecretKey key) throws Exception {

        Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding");
        cipher.init(Cipher.ENCRYPT_MODE, publicKey);

        return Base64.getEncoder()
                .encodeToString(cipher.doFinal(key.getEncoded()));
    }

    // ⭐ GENERIC SHA256 HASH (SERVICE LEVEL RULE APPLY KARNA)
    public String generateHash(String input) throws Exception {

        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));

        return Base64.getEncoder().encodeToString(digest);
    }

    // ⭐ TIMESTAMP FORMAT REQUIRED BY FINGPAY
    public String timestamp() {

        return LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
    }
}