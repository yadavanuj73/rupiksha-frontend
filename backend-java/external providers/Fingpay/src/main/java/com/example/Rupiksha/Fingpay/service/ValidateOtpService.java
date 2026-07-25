package com.example.Rupiksha.Fingpay.service;

import com.example.Rupiksha.Fingpay.config.FingpayClient;
import com.example.Rupiksha.Fingpay.dto.ValidateOtpRequestDTO;
import com.example.Rupiksha.Fingpay.entity.EkycTxn;
import com.example.Rupiksha.Fingpay.exception.FingpayException;
import com.example.Rupiksha.Fingpay.repository.EkycTxnRepo;
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
public class ValidateOtpService {

    private final FingpayClient client;
    private final FingpayEncryptionUtil encryptionUtil;
    private final ObjectMapper mapper;
    private final EkycTxnRepo repo;   // ⭐ NEW

    @Value("${fingpay.supermerchant.id}")
    private Integer superMerchantId;

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.ekyc.validate.url}")
    private String validateOtpUrl;

    public String validateOtp(ValidateOtpRequestDTO dto) {

        String txnId = UUID.randomUUID().toString();

        try {

            // ⭐ DB FETCH (VERY IMPORTANT)
            EkycTxn txn =
                    repo.findByMerchantLoginId(dto.getMerchantLoginId())
                            .orElseThrow(() ->
                                    new FingpayException("OTP flow not found"));

            Map<String, Object> bodyMap = new LinkedHashMap<>();
            bodyMap.put("superMerchantId", superMerchantId);
            bodyMap.put("merchantLoginId", dto.getMerchantLoginId());
            bodyMap.put("otp", dto.getOtp());

            // ⭐ Same values DB se bhi le sakte ho future me
            bodyMap.put("primaryKeyId", dto.getPrimaryKeyId());
            bodyMap.put("encodeFPTxnId", dto.getEncodeFPTxnId());

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
                    client.post(validateOtpUrl, encryptedBody, headers);

            if (response == null || response.isEmpty()) {
                throw new FingpayException("Empty response");
            }

            // ⭐ STATUS UPDATE
            txn.setStatus("OTP_VERIFIED");
            txn.setUpdatedAt(LocalDateTime.now());
            repo.save(txn);

            return response;

        } catch (Exception e) {

            throw new FingpayException("Validate OTP Failed");
        }
    }
}
