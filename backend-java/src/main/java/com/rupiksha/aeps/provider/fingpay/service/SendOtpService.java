package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.config.FingpayClient;
import com.rupiksha.aeps.provider.fingpay.dto.SendOtpRequestDTO;
import com.rupiksha.aeps.provider.fingpay.entity.EkycTxn;
import com.rupiksha.aeps.provider.fingpay.exception.FingpayException;
import com.rupiksha.aeps.provider.fingpay.repository.EkycTxnRepo;
import com.rupiksha.aeps.provider.fingpay.util.FingpayEncryptionUtil;
import com.fasterxml.jackson.databind.JsonNode;
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
public class SendOtpService {

    private final FingpayClient client;
    private final FingpayEncryptionUtil encryptionUtil;
    private final ObjectMapper mapper;
    private final EkycTxnRepo repo;   // ⭐ NEW

    @Value("${fingpay.supermerchant.id}")
    private Integer superMerchantId;

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.ekyc.url}")
    private String ekycUrl;

    public String sendOtp(SendOtpRequestDTO dto) {

        String txnId = UUID.randomUUID().toString();

        try {

            Map<String, Object> bodyMap = new LinkedHashMap<>();

            bodyMap.put("superMerchantId", superMerchantId);
            bodyMap.put("merchantLoginId", dto.getMerchantLoginId());
            bodyMap.put("transactionType", "EKY");
            bodyMap.put("mobileNumber", dto.getMobileNumber());
            bodyMap.put("aadharNumber", dto.getAadharNumber());
            bodyMap.put("panNumber", dto.getPanNumber());
            bodyMap.put("matmSerialNumber", deviceImei);
            bodyMap.put("latitude", dto.getLatitude());
            bodyMap.put("longitude", dto.getLongitude());

            String plainJson = mapper.writeValueAsString(bodyMap);

            SecretKey sessionKey = encryptionUtil.generateSessionKey();

            String encryptedBody =
                    encryptionUtil.encryptBody(plainJson, sessionKey).trim();

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
                    client.post(ekycUrl, encryptedBody, headers);

            if (response == null || response.isEmpty()) {
                throw new FingpayException("Empty response from Fingpay");
            }

            // ⭐ RESPONSE PARSE
            JsonNode node = mapper.readTree(response);

            Long primaryKeyId =
                    node.path("primaryKeyId").asLong();

            String encodeTxnId =
                    node.path("encodeFPTxnId").asText();

            // ⭐ DB SAVE
            EkycTxn txn = new EkycTxn();
            txn.setMerchantLoginId(dto.getMerchantLoginId());
            txn.setMobile(dto.getMobileNumber());
            txn.setAadhaarLast4(last4(dto.getAadharNumber()));
            txn.setPrimaryKeyId(primaryKeyId);
            txn.setEncodeFPTxnId(encodeTxnId);
            txn.setResendCount(0);
            txn.setStatus("OTP_SENT");
            txn.setTxnId(txnId);
            txn.setCreatedAt(LocalDateTime.now());

            repo.save(txn);

            return response;

        } catch (Exception e) {
            throw new FingpayException("Send OTP Failed");
        }
    }

    private String last4(String aadhaar){
        return aadhaar.substring(aadhaar.length()-4);
    }
}
