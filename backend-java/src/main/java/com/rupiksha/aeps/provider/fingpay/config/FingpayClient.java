package com.rupiksha.aeps.provider.fingpay.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class FingpayClient {

    private final RestTemplate rest;

    public String post(String url, String body, HttpHeaders headers) {

        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<String> entity = new HttpEntity<>(body, headers);

        // Use a no-op error handler so Fingpay 4xx/5xx responses are returned as body
        // instead of throwing HttpClientErrorException and losing the actual error message.
        RestTemplate rt = new RestTemplate();
        rt.setErrorHandler(new DefaultResponseErrorHandler() {
            @Override
            public boolean hasError(ClientHttpResponse response) throws IOException {
                int code = response.getStatusCode().value();
                if (code >= 400) {
                    log.warn("[FINGPAY CLIENT] Fingpay returned HTTP {}: treating as non-exception to preserve response body", code);
                }
                return false; // Never throw — always return body for inspection
            }
        });

        ResponseEntity<String> res = rt.exchange(url, HttpMethod.POST, entity, String.class);
        log.info("[FINGPAY CLIENT] HTTP {} from URL: {}", res.getStatusCode().value(), url);
        return res.getBody();
    }
}