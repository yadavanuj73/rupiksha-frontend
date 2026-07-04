package com.rupiksha.backend.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
public class HealthController {
    @GetMapping
    public Map<String, Object> health() {
        return Map.of(
                "ok", true,
                "service", "rupiksha-backend-java",
                "timestamp", Instant.now().toString()
        );
    }

    /**
     * TEMPORARY DEVELOPER DIAGNOSTICS: Outbound IP verification endpoint.
     * To be deleted after obtaining the whitelisted server IP.
     */
    @GetMapping("/outbound-ip")
    public String getOutboundIp() {
        RestTemplate restTemplate = new RestTemplate();
        try {
            return restTemplate.getForObject("https://api.ipify.org", String.class);
        } catch (Exception e) {
            try {
                return restTemplate.getForObject("https://ifconfig.me/ip", String.class);
            } catch (Exception ex) {
                return "Error fetching outbound IP: " + ex.getMessage();
            }
        }
    }
}

