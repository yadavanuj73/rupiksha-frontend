package com.rupiksha.aeps.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Component
@RequiredArgsConstructor
public class AepsClient {

    private final RestTemplate aepsRestTemplate;

    /**
     * Executes an HTTP request to the target provider url.
     * Reuses custom logging, retry mechanisms, and response handlers.
     */
    public <T, R> ResponseEntity<R> post(String url, T requestPayload, HttpHeaders headers, Class<R> responseType) {
        log.info("AepsClient initiating POST request to: {}", url);
        HttpEntity<T> entity = new HttpEntity<>(requestPayload, headers);
        return aepsRestTemplate.exchange(url, HttpMethod.POST, entity, responseType);
    }

    public <R> ResponseEntity<R> get(String url, HttpHeaders headers, Class<R> responseType) {
        log.info("AepsClient initiating GET request to: {}", url);
        HttpEntity<?> entity = new HttpEntity<>(headers);
        return aepsRestTemplate.exchange(url, HttpMethod.GET, entity, responseType);
    }
}
