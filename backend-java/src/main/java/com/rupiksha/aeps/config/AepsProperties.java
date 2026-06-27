package com.rupiksha.aeps.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "aeps")
public class AepsProperties {

    private String activeProvider = "levin";
    private Timeout timeout = new Timeout();
    private Retry retry = new Retry();
    private Map<String, ProviderConfig> providers = new HashMap<>();

    @Data
    public static class Timeout {
        private int connect = 30000;
        private int read = 30000;
    }

    @Data
    public static class Retry {
        private int maxAttempts = 3;
        private long backoffMs = 1000;
    }

    @Data
    public static class ProviderConfig {
        private String baseUrl;
        private String apiToken;
        private String userId;
        private String encryptionKey;
        private Map<String, String> additionalParams = new HashMap<>();
    }
}
