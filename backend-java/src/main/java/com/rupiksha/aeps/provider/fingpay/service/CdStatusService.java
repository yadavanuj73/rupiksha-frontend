package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.dto.CdStatusRequest;
import com.rupiksha.aeps.provider.fingpay.dto.CdStatusResponse;
import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import com.rupiksha.aeps.provider.fingpay.repository.AepsKycRepository;
import com.rupiksha.aeps.provider.fingpay.repository.FingUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class CdStatusService {

    private final AepsKycRepository aepsKycRepo;
    private final FingUserRepository userRepo;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${fingpay.cd.status.url}")
    private String cdStatusUrl;

    public CdStatusResponse checkStatus(CdStatusRequest req) {
        String merchantTranId = req.getMerchantTranId();
        try {
            AepsKyc kyc = aepsKycRepo.findByUid(req.getUid())
                    .orElseThrow(() -> new RuntimeException("AepsKyc not found for uid: " + req.getUid()));

            String merchantLoginId = kyc.getOutlet();
            String merchantPassword = (kyc.getMpin() != null)
                    ? kyc.getMpin()
                    : userRepo.findById(req.getUid())
                    .orElseThrow(() -> new RuntimeException("FingUser not found"))
                    .getPin();

            // Hash: Base64(SHA256(merchantTranId + "+" + MD5(merchantPassword)))
            String md5Password = md5(merchantPassword);
            String hashInput = merchantTranId + "+" + md5Password;
            String hash = generateHash(hashInput);

            // Request body JSON
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTranId", merchantTranId);
            payload.put("hash", hash);
            payload.put("merchantLoginId", merchantLoginId);

            String plainJson = objectMapper.writeValueAsString(payload);

            // Build target URL by substituting merchantLoginId template in path
            String actualUrl = cdStatusUrl;
            if (cdStatusUrl.contains("merchantLoginId")) {
                actualUrl = cdStatusUrl.replace("merchantLoginId", merchantLoginId.toLowerCase());
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> entity = new HttpEntity<>(plainJson, headers);
            ResponseEntity<String> httpResp = restTemplate.exchange(
                    actualUrl, HttpMethod.POST, entity, String.class);

            log.info("CD status response for txn {}: {}", merchantTranId, httpResp.getBody());

            JsonNode root = objectMapper.readTree(httpResp.getBody());
            
            CdStatusResponse response = new CdStatusResponse();
            response.setApiStatus(root.path("status").asBoolean(false) || "SUCCESS".equalsIgnoreCase(root.path("status").asText("")));
            response.setApiStatusMessage(root.path("message").asText(""));

            JsonNode data = root.path("data");
            if (!data.isMissingNode()) {
                response.setFingpayTransactionId(data.path("fingpayTransactionId").asText(""));
                response.setStan(data.path("stan").asText(""));
                response.setBankRRN(data.path("bankRRN").asText(""));
                response.setTransactionTime(data.path("transactionTime").asText(""));
                response.setMerchantTranId(data.path("merchantTranId").asText(""));
                response.setTransactionStatus(data.path("transactionStatus").asText(""));
                response.setTransactionAmount(data.path("transactionAmount").asDouble(0.0));
                response.setTransactionStatusCode(data.path("transactionStatusCode").asText(""));
                response.setTransactionStatusMessage(data.path("transactionStatusMessage").asText(""));
                response.setRemarks(data.path("remarks").asText(""));
                response.setBalanceAmount(data.path("balanceAmount").asDouble(0.0));
                response.setAadhaarNumber(data.path("aadhaarNumber").asText(""));
                response.setLatitude(data.path("latitude").asText(""));
                response.setLongitude(data.path("longitude").asText(""));
                response.setMobileNumber(data.path("mobileNumber").asText(""));
                response.setDeviceIMEI(data.path("deviceIMEI").asText(""));
                response.setBankName(data.path("bankName").asText(""));
            }

            return response;

        } catch (Exception e) {
            log.error("CD status check error uid={} txnId={} msg={}", req.getUid(), merchantTranId, e.getMessage(), e);
            CdStatusResponse response = new CdStatusResponse();
            response.setApiStatus(false);
            response.setApiStatusMessage("Status check failed: " + e.getMessage());
            return response;
        }
    }

    private String generateHash(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(hash);
    }

    private String md5(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
