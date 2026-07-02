package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.dto.CwStatusRequest;
import com.rupiksha.aeps.provider.fingpay.dto.CwStatusResponse;
import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import com.rupiksha.aeps.provider.fingpay.repository.AepsKycRepository;
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
public class CwStatusService {

    private final AepsKycRepository aepsKycRepo;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${fingpay.cw.status.url}")
    private String cwStatusUrl;

    @Value("${fingpay.username}")
    private String superMerchantLoginId;

    @Value("${fingpay.password}")
    private String superMerchantPassword; // already MD5 in properties

    @Value("${fingpay.supermerchant.id}")
    private String superMerchantId;

    public CwStatusResponse checkStatus(CwStatusRequest req) {
        try {
            // Merchant credentials
            AepsKyc kyc = aepsKycRepo.findByUid(req.getUid())
                    .orElseThrow(() -> new RuntimeException("AepsKyc not found for uid: " + req.getUid()));

            String merchantLoginId = kyc.getOutlet();

            // Hash generation as per API docs:
            // base64(SHA256(merchantTranId + "+" + merchantLoginId.lower + "+" + superMerchantLoginId.lower))
            String hashInput = req.getMerchantTranId()
                    + "+" + merchantLoginId.toLowerCase()
                    + "+" + superMerchantLoginId.toLowerCase();

            String hash = generateHash(hashInput);

            // Request payload
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTranId", req.getMerchantTranId());
            payload.put("merchantLoginId", merchantLoginId);
            payload.put("merchantPassword", ""); // not mandatory per docs
            payload.put("superMerchantId", Integer.parseInt(superMerchantId));
            payload.put("superMerchantPassword", superMerchantPassword);
            payload.put("hash", hash);

            String plainJson = objectMapper.writeValueAsString(payload);
            log.debug("CW status request JSON: {}", plainJson);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> entity = new HttpEntity<>(plainJson, headers);
            ResponseEntity<String> httpResp = restTemplate.exchange(
                    cwStatusUrl, HttpMethod.POST, entity, String.class);

            log.debug("CW status response: {}", httpResp.getBody());

            return objectMapper.readValue(httpResp.getBody(), CwStatusResponse.class);

        } catch (Exception e) {
            log.error("CW status check error uid={} txnId={} msg={}",
                    req.getUid(), req.getMerchantTranId(), e.getMessage(), e);
            CwStatusResponse resp = new CwStatusResponse();
            resp.setApiStatus(false);
            resp.setApiStatusMessage("Internal error: " + e.getMessage());
            return resp;
        }
    }

    // base64(SHA256(input))
    private String generateHash(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(hash);
    }
}