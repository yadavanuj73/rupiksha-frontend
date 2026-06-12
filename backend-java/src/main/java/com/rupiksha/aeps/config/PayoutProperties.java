package com.rupiksha.aeps.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "quickzaps.payout")
public class PayoutProperties {
    private String baseUrl;
    private String apiKey;
    private String payoutUrl;
}

// Made with Bob
