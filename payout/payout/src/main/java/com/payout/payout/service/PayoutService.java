package com.payout.payout.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.payout.payout.config.PayoutConfig;
import com.payout.payout.dto.PayoutRequest;
import com.payout.payout.dto.PayoutResponse;
import com.payout.payout.util.SignatureUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final PayoutConfig payoutConfig;

    public PayoutResponse initiatePayout(PayoutRequest payoutRequest) {
        try {
            String apiKey    = payoutConfig.getApiKey();
            String payoutUrl = payoutConfig.getPayoutUrl();

            // Step 1: DTO → Compact JSON
            // @JsonProperty + @JsonPropertyOrder handle karega PascalCase
            String compactJson = objectMapper.writeValueAsString(payoutRequest);

            // Step 2: Timestamp
            String timestamp = SignatureUtil.getCurrentTimestamp();

            // Step 3: Signature
            String signature = SignatureUtil.generateSignature(apiKey, timestamp, compactJson);

            // Debug logs
            log.info("========= QUICKZAPS DEBUG =========");
            log.info("API Key      : {}", apiKey);
            log.info("Timestamp    : {}", timestamp);
            log.info("Compact JSON : {}", compactJson);
            log.info("Signature    : {}", signature);
            log.info("===================================");

            // Step 4: Headers — sab automatically set ho rahe hain
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-api-key",    apiKey);
           // headers.set("x-request-id", payoutRequest.getOrderId());
            headers.set("x-signature",  signature);
            headers.set("x-timestamp",  timestamp);

            // Step 5: API Call
            HttpEntity<String> entity = new HttpEntity<>(compactJson, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                payoutUrl,
                HttpMethod.POST,
                entity,
                String.class
            );

            log.info("QuickZaps Response Status : {}", response.getStatusCode());
            log.info("QuickZaps Response Body   : {}", response.getBody());

            return objectMapper.readValue(response.getBody(), PayoutResponse.class);

        } catch (HttpClientErrorException e) {
            log.error("QuickZaps Error Status : {}", e.getStatusCode());
            log.error("QuickZaps Error Body   : {}", e.getResponseBodyAsString());
            try {
                return objectMapper.readValue(
                    e.getResponseBodyAsString(), PayoutResponse.class);
            } catch (Exception ex) {
                PayoutResponse error = new PayoutResponse();
                error.setStatusCode(String.valueOf(e.getStatusCode().value()));
                error.setMessage(e.getResponseBodyAsString());
                return error;
            }
        } catch (Exception e) {
            log.error("Payout failed: {}", e.getMessage(), e);
            PayoutResponse error = new PayoutResponse();
            error.setStatusCode("500");
            error.setMessage("Payout failed: " + e.getMessage());
            return error;
        }
    }
}
