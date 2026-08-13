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

            log.error("==================================================");
            log.error("FINAL BIOMETRIC PAYLOAD");
            log.error("==================================================");
            log.error("merchantLoginId: {}", dto.getMerchantLoginId());
            log.error("primaryKeyId: {}", dto.getPrimaryKeyId());
            log.error("encodeFPTxnId: {}", dto.getEncodeFPTxnId());
            log.error("Aadhaar number: {}", dto.getCardnumberORUID() != null ? dto.getCardnumberORUID().getAdhaarNumber() : null);

            if (dto.getCaptureResponse() != null) {
                BiometricRequestDTO.CaptureResponse cr = dto.getCaptureResponse();
                log.error("captureResponse.errCode: {}", cr.getErrCode());
                log.error("captureResponse.errInfo: {}", cr.getErrInfo());
                log.error("captureResponse.fCount: {}", cr.getFCount());
                log.error("captureResponse.fType: {}", cr.getFType());
                log.error("captureResponse.iCount: {}", cr.getICount());
                log.error("captureResponse.iType: {}", cr.getIType());
                log.error("captureResponse.pCount: {}", cr.getPCount());
                log.error("captureResponse.pType: {}", cr.getPType());
                log.error("captureResponse.qScore: {}", cr.getQScore());
                log.error("captureResponse.dpID: {}", cr.getDpID());
                log.error("captureResponse.rdsID: {}", cr.getRdsID());
                log.error("captureResponse.rdsVer: {}", cr.getRdsVer());
                log.error("captureResponse.ci: {}", cr.getCi());
                log.error("captureResponse.PidDatatype: {}", cr.getPidDatatype());
                log.error("captureResponse.sessionKey length: {}", cr.getSessionKey() != null ? cr.getSessionKey().length() : 0);
                log.error("captureResponse.hmac length: {}", cr.getHmac() != null ? cr.getHmac().length() : 0);
                log.error("captureResponse.Piddata length: {}", cr.getPiddata() != null ? cr.getPiddata().length() : 0);
            }

            log.error("COMPLETE plainJson before encryption: {}", plainJson);
            log.error("==================================================");

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
            log.error("1. Complete decrypted Fingpay response: {}", response);
            if (response != null && !response.isEmpty()) {
                try {
                    com.fasterxml.jackson.databind.JsonNode resNode = mapper.readTree(response);
                    log.error("2. status: {}", resNode.path("status").asText(null));
                    log.error("3. statusCode: {}", resNode.path("statusCode").asText(null));
                    log.error("4. message: {}", resNode.path("message").asText(null));
                    log.error("5. data: {}", resNode.path("data").isMissingNode() ? null : resNode.path("data").toString());
                } catch (Exception e) {
                    log.error("Failed to parse Fingpay response JSON for logging", e);
                }
            }
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
