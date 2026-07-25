package com.example.Rupiksha.Fingpay.service;

import com.example.Rupiksha.Fingpay.config.FingpayClient;
import com.example.Rupiksha.Fingpay.exception.FingpayException;
import com.example.Rupiksha.Fingpay.util.FingpayEncryptionUtil;
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

    public String checkStatus(String merchantLoginId) {

        String txnId = UUID.randomUUID().toString();

        try {

            log.info("===== EKYC STATUS START [{}] =====", txnId);

            Map<String, Object> bodyMap = new LinkedHashMap<>();
            bodyMap.put("superMerchantId", superMerchantId);
            bodyMap.put("merchantLoginId", merchantLoginId);

            String plainJson = mapper.writeValueAsString(bodyMap);

            String timestamp = encryptionUtil.timestamp();

            String hashInput = plainJson + securityKey + timestamp;
            String hash = encryptionUtil.generateHash(hashInput);

            HttpHeaders headers = new HttpHeaders();
            headers.add("trnTimestamp", timestamp);
            headers.add("hash", hash);
            headers.add("X-Correlation-ID", txnId);
            headers.add(HttpHeaders.CONTENT_TYPE, "application/json");

            String response =
                    client.post(statusUrl, plainJson, headers);

            if (response == null || response.isEmpty()) {
                throw new FingpayException("Empty EKYC status response");
            }

            log.info("EKYC STATUS SUCCESS [{}]", txnId);

            return response;

        } catch (Exception e) {

            log.error("EKYC STATUS FAILED [{}]", txnId, e);
            throw new FingpayException("Unable to fetch EKYC status");
        }
    }
}
