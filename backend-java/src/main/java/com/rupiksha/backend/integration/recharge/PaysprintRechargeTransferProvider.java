package com.rupiksha.backend.integration.recharge;

import com.rupiksha.backend.config.AppProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class PaysprintRechargeTransferProvider implements RechargeTransferProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;

    @Override
    public String providerName() {
        return "paysprint";
    }

    @Override
    public ProviderTxnResponse recharge(String userRef, String mobile, String operator, BigDecimal amount) {
        String baseUrl = appProperties.recharge().baseUrl();
        String key = appProperties.recharge().apiKey();
        if (baseUrl == null || baseUrl.isBlank() || key == null || key.isBlank()) {
            throw new IllegalArgumentException("Recharge provider not configured");
        }
        RestTemplate rt = restTemplateBuilder.build();
        String url = baseUrl + "/recharge";
        Map<String, Object> req = new HashMap<>();
        req.put("user_ref", userRef);
        req.put("mobile", mobile);
        req.put("operator", operator);
        req.put("amount", amount);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(key);
        ResponseEntity<Map> res = rt.exchange(url, HttpMethod.POST, new HttpEntity<>(req, headers), Map.class);
        Map body = res.getBody();
        boolean ok = body != null && Boolean.parseBoolean(String.valueOf(body.getOrDefault("success", "false")));
        String txnId = String.valueOf(body != null ? body.getOrDefault("txn_id", "") : "");
        String msg = String.valueOf(body != null ? body.getOrDefault("message", "") : "Provider response missing");
        return new ProviderTxnResponse(ok, txnId, msg, body);
    }

    @Override
    public ProviderTxnResponse transfer(String userRef, String beneficiary, String account, String ifsc, BigDecimal amount) {
        String baseUrl = appProperties.recharge().baseUrl();
        String key = appProperties.recharge().apiKey();
        if (baseUrl == null || baseUrl.isBlank() || key == null || key.isBlank()) {
            throw new IllegalArgumentException("Transfer provider not configured");
        }
        RestTemplate rt = restTemplateBuilder.build();
        String url = baseUrl + "/transfer";
        Map<String, Object> req = new HashMap<>();
        req.put("user_ref", userRef);
        req.put("beneficiary", beneficiary);
        req.put("account", account);
        req.put("ifsc", ifsc);
        req.put("amount", amount);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(key);
        ResponseEntity<Map> res = rt.exchange(url, HttpMethod.POST, new HttpEntity<>(req, headers), Map.class);
        Map body = res.getBody();
        boolean ok = body != null && Boolean.parseBoolean(String.valueOf(body.getOrDefault("success", "false")));
        String txnId = String.valueOf(body != null ? body.getOrDefault("txn_id", "") : "");
        String msg = String.valueOf(body != null ? body.getOrDefault("message", "") : "Provider response missing");
        return new ProviderTxnResponse(ok, txnId, msg, body);
    }
}

