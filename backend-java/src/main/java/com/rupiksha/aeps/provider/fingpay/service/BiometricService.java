package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.config.FingpayClient;
import com.rupiksha.aeps.provider.fingpay.dto.BiometricRequestDTO;
import com.rupiksha.aeps.provider.fingpay.entity.EkycTxn;
import com.rupiksha.aeps.provider.fingpay.exception.FingpayException;
import com.rupiksha.aeps.provider.fingpay.util.FingpayEncryptionUtil;
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
public class BiometricService {

    private final FingpayClient client;
    private final FingpayEncryptionUtil encryptionUtil;
    private final ObjectMapper mapper;
    private final com.rupiksha.aeps.provider.fingpay.repository.EkycTxnRepo repo;

    @Value("${fingpay.supermerchant.id}")
    private Integer superMerchantId;

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.ekyc.biometric.url}")
    private String biometricUrl;

    public String biometric(BiometricRequestDTO dto) {

        String txnId = UUID.randomUUID().toString();

        try {

            log.info("===== BIOMETRIC START [{}] =====", txnId);

            // ⭐ DB FETCH
            EkycTxn txn =
                    repo.findTopByMerchantLoginIdOrderByIdDesc(dto.getMerchantLoginId())
                            .orElseThrow(() ->
                                    new FingpayException("EKYC txn not found"));

            Map<String, Object> bodyMap = new LinkedHashMap<>();
            bodyMap.put("superMerchantId", superMerchantId);
            bodyMap.put("merchantLoginId", dto.getMerchantLoginId());
            bodyMap.put("primaryKeyId", dto.getPrimaryKeyId());
            bodyMap.put("encodeFPTxnId", dto.getEncodeFPTxnId());
            bodyMap.put("requestRemarks",
                    dto.getRequestRemarks() != null ? dto.getRequestRemarks() : "WORKING");
            bodyMap.put("cardnumberORUID", dto.getCardnumberORUID());
            bodyMap.put("captureResponse", dto.getCaptureResponse());

            String plainJson = mapper.writeValueAsString(bodyMap);

            log.error("========== FINGPAY BIOMETRIC DETAILED DEBUG REQUEST ==========");
            log.error("superMerchantId={}", superMerchantId);
            log.error("merchantLoginId={}", dto.getMerchantLoginId());
            log.error("primaryKeyId={}", dto.getPrimaryKeyId());
            log.error("encodeFPTxnId={}", dto.getEncodeFPTxnId());

            if (dto.getCaptureResponse() != null) {
                log.error("fType={}", dto.getCaptureResponse().getFType());
                log.error("fCount={}", dto.getCaptureResponse().getFCount());
                log.error("PidDatatype={}", dto.getCaptureResponse().getPidDatatype());
                log.error(
                    "Piddata length={}",
                    dto.getCaptureResponse().getPiddata() == null
                        ? 0
                        : dto.getCaptureResponse().getPiddata().length()
                );
                log.error(
                    "sessionKey length={}",
                    dto.getCaptureResponse().getSessionKey() == null
                        ? 0
                        : dto.getCaptureResponse().getSessionKey().length()
                );
                log.error(
                    "hmac length={}",
                    dto.getCaptureResponse().getHmac() == null
                        ? 0
                        : dto.getCaptureResponse().getHmac().length()
                );
            }

            log.error(
                "Complete unencrypted request body={}",
                plainJson
            );

            log.error("=============================================================");

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
                    client.post(biometricUrl, encryptedBody, headers);

            log.error("========== FINGPAY BIOMETRIC RESPONSE ==========");
            log.error(response);
            log.error("===============================================");

            if (response == null || response.isEmpty()) {
                throw new FingpayException("Empty biometric response");
            }

            // ⭐ DB STATUS UPDATE
            txn.setBiometricStatus("DONE");
            txn.setBiometricAt(LocalDateTime.now());
            repo.save(txn);

            log.info("BIOMETRIC SUCCESS [{}]", txnId);

            return response;

        } catch (Exception e) {

            log.error("BIOMETRIC FAILED [{}]", txnId, e);
            throw new FingpayException("Biometric Failed");
        }
    }
}
