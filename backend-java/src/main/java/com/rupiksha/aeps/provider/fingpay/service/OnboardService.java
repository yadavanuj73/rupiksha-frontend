package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.config.FingpayClient;
import com.rupiksha.aeps.provider.fingpay.dto.OnboardRequestDTO;
import com.rupiksha.aeps.provider.fingpay.entity.OnboardTxn;
import com.rupiksha.aeps.provider.fingpay.exception.FingpayException;
import com.rupiksha.aeps.provider.fingpay.repository.OnboardTxnRepo;
import com.rupiksha.aeps.provider.fingpay.util.FingpayEncryptionUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OnboardService {

    private final FingpayClient client;
    private final ObjectMapper mapper;
    private final FingpayEncryptionUtil encryptionUtil;
    private final OnboardTxnRepo repo;   // ⭐ NEW

    @Value("${fingpay.onboard.url}")
    private String url;

    @Value("${fingpay.username}")
    private String username;

    @Value("${fingpay.password}")
    private String password;

    @Value("${fingpay.supermerchant.id}")
    private Integer superMerchantId;

    @Value("${fingpay.ip}")
    private String ip;

    public String onboard(OnboardRequestDTO dto) {

        String txnId = UUID.randomUUID().toString();

        // ⭐ DB INSERT (INIT)
        OnboardTxn txn = new OnboardTxn();
        txn.setMerchantLoginId(dto.getMerchant().getMerchantLoginId());
        txn.setTxnId(txnId);
        txn.setStatus("INIT");
        txn.setCreatedAt(LocalDateTime.now());
        repo.save(txn);

        try {

            dto.setUsername(username);
            dto.setPassword(password);
            dto.setSuperMerchantId(superMerchantId);
            dto.setIpAddress(ip);

            String plainJson = mapper.writeValueAsString(dto);

            SecretKey sessionKey = encryptionUtil.generateSessionKey();

            String encryptedBody =
                    encryptionUtil.encryptBody(plainJson, sessionKey);

            String eskey =
                    encryptionUtil.encryptSessionKey(sessionKey);

            String hash =
                    encryptionUtil.generateHash(encryptedBody);

            String timestamp =
                    encryptionUtil.timestamp();

            HttpHeaders headers = new HttpHeaders();
            headers.add("trnTimestamp", timestamp);
            headers.add("hash", hash);
            headers.add("eskey", eskey);
            headers.add("X-Correlation-ID", txnId);
            headers.add(HttpHeaders.CONTENT_TYPE, "text/plain");

            String response =
                    client.post(url, encryptedBody, headers);

            if (response == null || response.isEmpty()) {
                txn.setStatus("FAILED");
                repo.save(txn);
                throw new FingpayException("Empty response");
            }

            // ⭐ DB UPDATE SUCCESS
            txn.setStatus("SENT");
            txn.setUpdatedAt(LocalDateTime.now());
            repo.save(txn);

            return response;

        } catch (Exception e) {

            txn.setStatus("FAILED");
            txn.setUpdatedAt(LocalDateTime.now());
            repo.save(txn);

            log.error("Fingpay onboarding failed. Cause: {}", e.getMessage(), e);
            throw new FingpayException("Onboarding Failed: " + e.getMessage());
        }
    }
}
