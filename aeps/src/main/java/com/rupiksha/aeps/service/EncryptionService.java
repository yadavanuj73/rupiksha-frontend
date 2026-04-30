package com.rupiksha.aeps.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class EncryptionService {

    @Value("${levin.aeps.encryption-key}")
    private String passphrase;

    private void deriveKeyAndIV(
            String passphrase,
            byte[] salt,
            byte[] key,
            byte[] iv) throws Exception {

        MessageDigest md5 =
                MessageDigest.getInstance("MD5");

        byte[] pass =
                passphrase.getBytes("UTF-8");

        byte[] hash = new byte[0];
        byte[] result = new byte[48];

        int offset = 0;

        while (offset < 48) {

            md5.update(hash);
            md5.update(pass);
            md5.update(salt);

            hash = md5.digest();

            System.arraycopy(
                    hash,
                    0,
                    result,
                    offset,
                    Math.min(hash.length,
                            48 - offset));

            offset += hash.length;
        }

        System.arraycopy(result, 0, key, 0, 32);
        System.arraycopy(result, 32, iv, 0, 16);
    }

    public String encrypt(String plainText) {

        try {

            byte[] salt = new byte[8];
            new SecureRandom().nextBytes(salt);

            byte[] key = new byte[32];
            byte[] iv = new byte[16];

            deriveKeyAndIV(
                    passphrase,
                    salt,
                    key,
                    iv);

            Cipher cipher =
                    Cipher.getInstance(
                            "AES/CBC/PKCS5Padding");

            cipher.init(
                    Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(key, "AES"),
                    new IvParameterSpec(iv)
            );

            byte[] encrypted =
                    cipher.doFinal(
                            plainText.getBytes("UTF-8"));

            ByteArrayOutputStream output =
                    new ByteArrayOutputStream();

            output.write("Salted__".getBytes());
            output.write(salt);
            output.write(encrypted);

            return Base64.getEncoder()
                    .encodeToString(
                            output.toByteArray());

        } catch (Exception e) {

            throw new RuntimeException(
                    "Encryption Failed", e);
        }
    }
}