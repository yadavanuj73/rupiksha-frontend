package com.rupiksha.aeps.provider.fingpay.config;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
public class FingpayClient {

    private final RestTemplate rest;

    public String post(String url, String body, HttpHeaders headers){

        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<String> entity =
                new HttpEntity<>(body, headers);

        ResponseEntity<String> res =
                rest.postForEntity(url, entity, String.class);

        return res.getBody();
    }
}