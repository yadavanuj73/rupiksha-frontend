package com.rupiksha.backend.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}

