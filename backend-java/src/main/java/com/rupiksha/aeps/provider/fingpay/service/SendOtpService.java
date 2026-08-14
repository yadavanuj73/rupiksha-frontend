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
            if (superMerchantId == null || deviceImei == null || deviceImei.isBlank() || ekycUrl == null || ekycUrl.isBlank()) {
                throw new FingpayException("Fingpay configuration missing: superMerchantId/deviceIMEI/ekycUrl is not set.");
            }

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

            // ⭐ RESPONSE PARSE & DIAGNOSTIC LOGGING
            JsonNode node = mapper.readTree(response);

            JsonNode dataNode = node.hasNonNull("data") && node.get("data").isObject() ? node.get("data") : null;

            // Extract primaryKeyId from top-level or nested data node
            Long primaryKeyId = node.hasNonNull("primaryKeyId")
                    ? node.path("primaryKeyId").asLong(0)
                    : (dataNode != null ? dataNode.path("primaryKeyId").asLong(0) : 0L);

            // Extract encodeFPTxnId from top-level or nested data node
            String encodeTxnId = node.hasNonNull("encodeFPTxnId")
                    ? node.path("encodeFPTxnId").asText("")
                    : (dataNode != null ? dataNode.path("encodeFPTxnId").asText("") : "");

            String message = "Fingpay OTP generation failed";
            if (node.has("message") && !node.path("message").asText().isBlank()) {
                message = node.path("message").asText().trim();
            } else if (node.has("remarks") && !node.path("remarks").asText().isBlank()) {
                message = node.path("remarks").asText().trim();
            } else if (dataNode != null && dataNode.has("remarks") && !dataNode.path("remarks").asText().isBlank()) {
                message = dataNode.path("remarks").asText().trim();
            } else if (dataNode != null && dataNode.has("message") && !dataNode.path("message").asText().isBlank()) {
                message = dataNode.path("message").asText().trim();
            }

            boolean merchantStatus = dataNode != null && dataNode.path("merchantStatus").asBoolean(false);
            boolean ekycCompleted = dataNode != null && dataNode.path("ekycCompleted").asBoolean(false);
            boolean successFlag = node.path("success").asBoolean(false) || (dataNode != null && dataNode.path("success").asBoolean(false));
            boolean statusFlag = node.path("status").asBoolean(false) || (dataNode != null && dataNode.path("status").asBoolean(false));
            int statusCode = node.path("statusCode").asInt(node.path("statusId").asInt(dataNode != null ? dataNode.path("statusCode").asInt(0) : 0));

            log.info("[FINGPAY SEND-OTP DIAGNOSTICS] success={}, status={}, statusCode={}, message='{}', merchantStatus={}, primaryKeyId={}, encodeTxnId='{}', ekycCompleted={}",
                    successFlag, statusFlag, statusCode, message, merchantStatus, primaryKeyId, encodeTxnId, ekycCompleted);

            boolean isOtpGenerated = primaryKeyId > 0 && !encodeTxnId.isBlank() && (successFlag || statusFlag || statusCode == 1 || statusCode == 200);

            if (!isOtpGenerated) {
                log.error("[FINGPAY SEND-OTP REJECTED] merchantLoginId={}, primaryKeyId={}, encodeTxnId='{}', merchantStatus={}, success={}, status={}, statusCode={}, message='{}'",
                        dto.getMerchantLoginId(), primaryKeyId, encodeTxnId, merchantStatus, successFlag, statusFlag, statusCode, message);
                throw new FingpayException("Fingpay OTP session not created. providerMessage='" + message
                    + "', merchantLoginId='" + dto.getMerchantLoginId()
                    + "', merchantStatus=" + merchantStatus
                    + ", success=" + successFlag
                    + ", status=" + statusFlag
                    + ", statusCode=" + statusCode
                    + ", primaryKeyId=" + primaryKeyId
                    + ", encodeFPTxnId='" + encodeTxnId + "'.");
            }

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

        } catch (FingpayException fe) {
            throw fe;
        } catch (Exception e) {
            log.error("Send OTP execution failed: {}", e.getMessage(), e);
            throw new FingpayException("Send OTP Failed: " + e.getMessage());
        }
    }

    private String last4(String aadhaar){
        return aadhaar.substring(aadhaar.length()-4);
    }
}
