package com.rupiksha.backend.integration.recharge;

import com.rupiksha.backend.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class VenusRechargeProvider implements RechargeTransferProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;

    @Override
    public String providerName() {
        return "venus";
    }

    @Override
    public ProviderTxnResponse recharge(String userRef, String mobile, String operator, BigDecimal amount) {
        String baseUrl = appProperties.venusRecharge().baseUrl();
        String authKey = appProperties.venusRecharge().authKey();
        String authPass = appProperties.venusRecharge().authPass();

        if (baseUrl == null || baseUrl.isBlank() || authKey == null || authKey.isBlank() || authPass == null || authPass.isBlank()) {
            log.error("VenusRecharge credentials are not fully configured. BaseUrl: {}, AuthKey exists: {}, AuthPass exists: {}",
                    baseUrl, authKey != null && !authKey.isBlank(), authPass != null && !authPass.isBlank());
            return new ProviderTxnResponse(false, null, "VenusRecharge provider not fully configured", Map.of("status", "FAILED"));
        }

        // Validate operator using configurable mapping
        Map<String, String> mappings = appProperties.venusRecharge().operatorMappings();
        if (mappings == null || mappings.isEmpty()) {
            log.warn("CRITICAL: The official Venus operator list is still required and not present! Using empty mappings.");
            return new ProviderTxnResponse(false, null, "Official Venus operator list is still required and not configured.", Map.of("status", "FAILED"));
        }

        String mappedOperator = mappings.get(operator);
        if (mappedOperator == null) {
            log.error("Unsupported operator code sent to VenusRecharge: {}. Valid mappings: {}", operator, mappings.keySet());
            return new ProviderTxnResponse(false, null, "Unsupported operator code: " + operator, Map.of("status", "FAILED"));
        }

        // Build RestTemplate with reasonable timeouts (e.g. 10s connect, 20s read)
        RestTemplate rt = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(20))
                .build();

        String url = baseUrl.trim();
        if (!url.endsWith("/")) {
            url += "/";
        }
        url += "api/recharge/transaction";

        Map<String, Object> req = new HashMap<>();
        req.put("mobileNo", mobile);
        req.put("operatorCode", mappedOperator);
        req.put("merchantRefNo", userRef); // Generates 14-char reference on backend
        req.put("serviceType", "MR");
        req.put("amount", amount.toString());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authkey", authKey.trim());
        headers.set("authpass", authPass.trim());

        log.info("Initiating VenusRecharge request. Mobile: {}, Operator: {}, Amount: {}, MerchantRefNo: {}",
                mobile, operator, amount, userRef);

        try {
            ResponseEntity<Map> res = rt.exchange(url, HttpMethod.POST, new HttpEntity<>(req, headers), Map.class);
            Map body = res.getBody();
            if (body == null) {
                log.error("VenusRecharge returned empty body for Ref: {}", userRef);
                return new ProviderTxnResponse(false, null, "Empty response body from provider", Map.of("status", "PENDING", "isTimeout", true));
            }

            log.info("VenusRecharge response body received for Ref: {}", userRef);

            // Resilient case-insensitive parsing
            String responseStatus = getCaseInsensitiveString(body, "responseStatus");
            String description = getCaseInsensitiveString(body, "description");
            String operatorTxnId = getCaseInsensitiveString(body, "operatorTxnId");
            String orderNo = getCaseInsensitiveString(body, "orderNo");

            Map<String, Object> rawMap = new HashMap<>();
            for (Object key : body.keySet()) {
                rawMap.put(String.valueOf(key), body.get(key));
            }
            rawMap.put("status", responseStatus);

            if ("SUCCESS".equalsIgnoreCase(responseStatus)) {
                return new ProviderTxnResponse(true, operatorTxnId != null ? operatorTxnId : orderNo, description, rawMap);
            } else if ("FAILED".equalsIgnoreCase(responseStatus)) {
                return new ProviderTxnResponse(false, null, description != null ? description : "Recharge failed", rawMap);
            } else {
                // Return success = false, but mark status as PENDING in raw mapping
                rawMap.put("status", "PENDING");
                return new ProviderTxnResponse(false, null, description != null ? description : "Recharge pending", rawMap);
            }

        } catch (ResourceAccessException e) {
            log.error("ResourceAccessException (Connection Timeout/Refused) calling VenusRecharge for Ref: {}", userRef, e);
            // Must keep in PENDING status for manual reconciliation (uncertain provider state)
            return new ProviderTxnResponse(false, null, "Connection timeout calling provider: " + e.getMessage(), Map.of("status", "PENDING", "isTimeout", true));
        } catch (RestClientException e) {
            log.error("RestClientException calling VenusRecharge for Ref: {}", userRef, e);
            return new ProviderTxnResponse(false, null, "Error calling provider: " + e.getMessage(), Map.of("status", "PENDING", "isTimeout", true));
        }
    }

    @Override
    public ProviderTxnResponse transfer(String userRef, String beneficiary, String account, String ifsc, BigDecimal amount) {
        log.error("Money transfer is not supported by VenusRecharge provider");
        return new ProviderTxnResponse(false, null, "Money transfer not supported by VenusRecharge provider", Map.of("status", "FAILED"));
    }

    /**
     * Query transaction status from Venus Recharge status API
     */
    public ProviderTxnResponse getStatus(String merchantRefNo) {
        String baseUrl = appProperties.venusRecharge().baseUrl();
        String authKey = appProperties.venusRecharge().authKey();
        String authPass = appProperties.venusRecharge().authPass();

        if (baseUrl == null || baseUrl.isBlank() || authKey == null || authKey.isBlank() || authPass == null || authPass.isBlank()) {
            return new ProviderTxnResponse(false, null, "VenusRecharge credentials not configured", Map.of("status", "FAILED"));
        }

        RestTemplate rt = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(15))
                .build();

        String url = baseUrl.trim();
        if (!url.endsWith("/")) {
            url += "/";
        }
        url += "api/recharge/status/" + merchantRefNo.trim();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authkey", authKey.trim());
        headers.set("authpass", authPass.trim());

        try {
            // Using POST with empty body as per provider documentation
            ResponseEntity<Map> res = rt.exchange(url, HttpMethod.POST, new HttpEntity<>("{}", headers), Map.class);
            Map body = res.getBody();
            if (body == null) {
                return new ProviderTxnResponse(false, null, "Empty status response from provider", Map.of("status", "PENDING"));
            }

            String responseStatus = getCaseInsensitiveString(body, "responseStatus");
            String description = getCaseInsensitiveString(body, "description");
            String operatorTxnId = getCaseInsensitiveString(body, "operatorTxnId");
            String orderNo = getCaseInsensitiveString(body, "orderNo");

            Map<String, Object> rawMap = new HashMap<>();
            for (Object key : body.keySet()) {
                rawMap.put(String.valueOf(key), body.get(key));
            }
            rawMap.put("status", responseStatus);

            if ("SUCCESS".equalsIgnoreCase(responseStatus)) {
                return new ProviderTxnResponse(true, operatorTxnId != null ? operatorTxnId : orderNo, description, rawMap);
            } else if ("FAILED".equalsIgnoreCase(responseStatus)) {
                return new ProviderTxnResponse(false, null, description != null ? description : "Recharge failed", rawMap);
            } else {
                rawMap.put("status", "PENDING");
                return new ProviderTxnResponse(false, null, description != null ? description : "Recharge pending", rawMap);
            }
        } catch (Exception e) {
            log.error("Exception querying VenusRecharge status for Ref: {}", merchantRefNo, e);
            return new ProviderTxnResponse(false, null, "Error querying status: " + e.getMessage(), Map.of("status", "PENDING"));
        }
    }

    /**
     * Get Provider Account Balance (Admin Only)
     */
    public Map<String, Object> getProviderBalance() {
        String baseUrl = appProperties.venusRecharge().baseUrl();
        String authKey = appProperties.venusRecharge().authKey();
        String authPass = appProperties.venusRecharge().authPass();

        if (baseUrl == null || baseUrl.isBlank() || authKey == null || authKey.isBlank() || authPass == null || authPass.isBlank()) {
            return Map.of("success", false, "message", "VenusRecharge credentials not configured");
        }

        RestTemplate rt = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(15))
                .build();

        String url = baseUrl.trim();
        if (!url.endsWith("/")) {
            url += "/";
        }
        url += "api/balance/recharge";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authkey", authKey.trim());
        headers.set("authpass", authPass.trim());

        try {
            ResponseEntity<Map> res = rt.exchange(url, HttpMethod.POST, new HttpEntity<>("{}", headers), Map.class);
            Map body = res.getBody();
            if (body == null) {
                return Map.of("success", false, "message", "Empty response from balance API");
            }

            String responseStatus = getCaseInsensitiveString(body, "responseStatus");
            String description = getCaseInsensitiveString(body, "description");
            Object balanceVal = getCaseInsensitiveValue(body, "blance"); // Note provider documentation spelling: 'blance'
            if (balanceVal == null) {
                balanceVal = getCaseInsensitiveValue(body, "balance"); // Fallback to standard spelling
            }

            if ("SUCCESS".equalsIgnoreCase(responseStatus)) {
                return Map.of("success", true, "balance", balanceVal != null ? balanceVal.toString() : "0.00", "description", description);
            } else {
                return Map.of("success", false, "message", description != null ? description : "Failed to fetch balance", "raw", body);
            }
        } catch (Exception e) {
            log.error("Exception fetching VenusRecharge provider balance", e);
            return Map.of("success", false, "message", "Error calling balance API: " + e.getMessage());
        }
    }

    private String getCaseInsensitiveString(Map map, String targetKey) {
        Object val = getCaseInsensitiveValue(map, targetKey);
        return val != null ? val.toString().trim() : null;
    }

    private Object getCaseInsensitiveValue(Map map, String targetKey) {
        if (map == null || targetKey == null) return null;
        for (Object key : map.keySet()) {
            if (String.valueOf(key).equalsIgnoreCase(targetKey)) {
                return map.get(key);
            }
        }
        return null;
    }
}
