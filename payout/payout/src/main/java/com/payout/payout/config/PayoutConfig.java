package com.payout.payout.config;

import org.apache.hc.client5.http.classic.HttpClient;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class PayoutConfig {

    @Value("${quickzaps.api-key}")
    private String apiKey;

    @Value("${quickzaps.payout-url}")
    private String payoutUrl;

    public String getApiKey()    { return apiKey; }
    public String getPayoutUrl() { return payoutUrl; }

    @Bean
    public RestTemplate restTemplate() {
        RequestConfig requestConfig = RequestConfig.custom()
            .setConnectTimeout(Timeout.ofSeconds(10))
            .setResponseTimeout(Timeout.ofSeconds(30))
            .build();

        HttpClient httpClient = HttpClientBuilder.create()
            .disableRedirectHandling()
            .setDefaultRequestConfig(requestConfig)
            .build();

        return new RestTemplate(
            new HttpComponentsClientHttpRequestFactory(httpClient)
        );
    }
}
