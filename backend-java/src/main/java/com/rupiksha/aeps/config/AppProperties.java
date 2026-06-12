package com.rupiksha.aeps.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "levin")
public class AppProperties {
    
    private Environment environment = new Environment();
    private String publicBaseUrl;
    
    @Data
    public static class Environment {
        private boolean allowMockProvidersInProduction = false;
    }
}

// Made with Bob