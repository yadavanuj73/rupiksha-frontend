package com.example.Rupiksha.Fingpay.service;

import com.example.Rupiksha.Fingpay.config.FingpayClient;
import com.example.Rupiksha.Fingpay.dto.ResendOtpRequestDTO;
import com.example.Rupiksha.Fingpay.entity.EkycTxn;
import com.example.Rupiksha.Fingpay.util.FingpayEncryptionUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResendOtpService {

    private final FingpayClient client;
    private final FingpayEncryptionUtil encryptionUtil;
    private final ObjectMapper mapper;
    private final com.example.Rupiksha.Fingpay.repository.EkycTxnRepo repo;

    @Value("${fingpay.supermerchant.id}")
    private Integer superMerchantId;

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.ekyc.resend.url}")
    private String resendOtpUrl;

    public String resendOtp(ResendOtpRequestDTO dto) {

        String txnId = UUID.randomUUID().toString();

        try {

            log.info("RESEND OTP START [{}]", txnId);

            // ⭐ DB FETCH
            EkycTxn txn =
                    repo.findByMerchantLoginId(dto.getMerchantLoginId())
                            .orElseThrow(() ->
                                    new RuntimeException("OTP txn not found"));

            Map<String, Object> bodyMap = new LinkedHashMap<>();
            bodyMap.put("superMerchantId", superMerchantId);
            bodyMap.put("merchantLoginId", dto.getMerchantLoginId());
            bodyMap.put("primaryKeyId", txn.getPrimaryKeyId());
            bodyMap.put("encodeFPTxnId", txn.getEncodeFPTxnId());

            String plainJson = mapper.writeValueAsString(bodyMap);

            SecretKey sessionKey = encryptionUtil.generateSessionKey();

            String encryptedBody =
                    encryptionUtil.encryptBody(plainJson, sessionKey);

            String eskey =
                    encryptionUtil.encryptSessionKey(sessionKey);

            String timestamp =
                    encryptionUtil.timestamp();

            String hash =
                    encryptionUtil.generateHash(plainJson);

            HttpHeaders headers = new HttpHeaders();
            headers.add("trnTimestamp", timestamp);
            headers.add("hash", hash);
            headers.add("eskey", eskey);
            headers.add("deviceIMEI", deviceImei);
            headers.add("X-Correlation-ID", txnId);
            headers.add(HttpHeaders.CONTENT_TYPE, "text/plain");

            String response =
                    client.post(resendOtpUrl, encryptedBody, headers);

            if (response == null || response.isEmpty()) {
                throw new RuntimeException("Empty response");
            }

            // ⭐ ONLY TRACKING UPDATE
            txn.setResendCount(txn.getResendCount() + 1);
            txn.setUpdatedAt(LocalDateTime.now());
            repo.save(txn);

            log.info("RESEND OTP SUCCESS [{}]", txnId);

            return response;

        } catch (Exception e) {

            log.error("RESEND OTP FAILED [{}]", txnId, e);
            throw new RuntimeException("Resend OTP Failed");
        }
    }
}
