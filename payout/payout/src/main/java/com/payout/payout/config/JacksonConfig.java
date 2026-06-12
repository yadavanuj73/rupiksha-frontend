package com.payout.payout.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        // Default ObjectMapper - koi extra config nahi
        // @JsonProperty annotations handle karenge field names
        return new ObjectMapper();
    }
}
