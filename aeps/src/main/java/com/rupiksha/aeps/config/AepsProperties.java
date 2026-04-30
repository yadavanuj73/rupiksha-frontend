package com.rupiksha.aeps.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;


@Data

@ConfigurationProperties(prefix = "levin.aeps")
public class AepsProperties {

    private String baseUrl;
    private String apiToken;
    private String userId;
    private String encryptionKey;   // 🔥 add this

}