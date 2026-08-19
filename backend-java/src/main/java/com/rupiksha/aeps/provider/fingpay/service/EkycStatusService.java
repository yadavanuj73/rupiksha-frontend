package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.config.FingpayClient;
import com.rupiksha.aeps.provider.fingpay.exception.FingpayException;
import com.rupiksha.aeps.provider.fingpay.util.FingpayEncryptionUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class EkycStatusService {

    private final FingpayClient client;
    private final FingpayEncryptionUtil encryptionUtil;
    private final ObjectMapper mapper;

    @Value("${fingpay.supermerchant.id}")
    private Integer superMerchantId;

    @Value("${fingpay.api.secret}")
    private String securityKey;

    @Value("${fingpay.ekyc.status.url}")
    private String statusUrl;

    /**
     * Checks the standard onboarding eKYC status for a merchant.
     * Uses plain JSON body (no encryption) with SHA-256 hash per Fingpay spec.
     */
    public String checkStatus(String merchantLoginId) {
        return doStatusCheck(merchantLoginId, "EKYC", null, null);
    }

    /**
     * Checks the Bank eKYC (BeKYC) status for a merchant.
     * Sends kycType="BeKYC" and optionally primaryKeyId + encodeFPTxnId.
     * Per Fingpay doc Section 7: if no EncodeFPTxnId/PrimaryKeyId provided,
     * the system defaults to the top record.
     *
     * @param merchantLoginId    Fingpay merchant login ID
     * @param primaryKeyId       Optional — from the sendOTP response
     * @param encodeFPTxnId      Optional — from the sendOTP response
     */
    public String checkBankEkycStatus(String merchantLoginId, Long primaryKeyId, String encodeFPTxnId) {
        return doStatusCheck(merchantLoginId, "BeKYC", primaryKeyId, encodeFPTxnId);
    }

    private String doStatusCheck(String merchantLoginId, String kycType, Long primaryKeyId, String encodeFPTxnId) {

        String txnId = UUID.randomUUID().toString();

        try {
            log.info("===== EKYC STATUS START [{}] kycType={} =====", txnId, kycType);

            Map<String, Object> bodyMap = new LinkedHashMap<>();
            bodyMap.put("superMerchantId", superMerchantId);
            bodyMap.put("merchantLoginId", merchantLoginId);
            bodyMap.put("kycType", kycType);

            // Only include if provided — per doc, defaults to top record when missing
            if (primaryKeyId != null && primaryKeyId > 0) {
                bodyMap.put("primaryKeyId", primaryKeyId);
            }
            if (encodeFPTxnId != null && !encodeFPTxnId.isBlank()) {
                bodyMap.put("encodeFPTxnId", encodeFPTxnId);
            }

            String plainJson = mapper.writeValueAsString(bodyMap);

            String timestamp = encryptionUtil.timestamp();

            // Per doc: hash = SHA-256(json + securityKey + timestamp) then Base64
            String hashInput = plainJson + securityKey + timestamp;
            String hash = encryptionUtil.generateHash(hashInput);

            HttpHeaders headers = new HttpHeaders();
            headers.add("trnTimestamp", timestamp);
            headers.add("hash", hash);
            headers.add("X-Correlation-ID", txnId);
            headers.add(HttpHeaders.CONTENT_TYPE, "application/json");

            String response = client.post(statusUrl, plainJson, headers);

            if (response == null || response.isEmpty()) {
                throw new FingpayException("Empty EKYC status response");
            }

            log.info("EKYC STATUS SUCCESS [{}] kycType={}", txnId, kycType);

            return response;

        } catch (Exception e) {
            log.error("EKYC STATUS FAILED [{}] kycType={}", txnId, kycType, e);
            throw new FingpayException("Unable to fetch EKYC status: " + e.getMessage());
        }
    }
}
