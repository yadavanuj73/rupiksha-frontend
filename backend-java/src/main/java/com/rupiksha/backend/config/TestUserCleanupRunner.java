package com.rupiksha.backend.config;

import com.rupiksha.backend.service.TestUserCleanupService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@Order(100)
@RequiredArgsConstructor
public class TestUserCleanupRunner implements CommandLineRunner {

    private final TestUserCleanupService testUserCleanupService;

    @Override
    public void run(String... args) {
        log.info("TestUserCleanupRunner: Executing QA test user cleanup check on application startup...");
        try {
            Map<String, Object> result = testUserCleanupService.cleanupTestUsers();
            log.info("TestUserCleanupRunner: Finished QA test user cleanup. Result: {}", result);
        } catch (Exception e) {
            log.error("TestUserCleanupRunner: Handled unexpected exception during startup test user cleanup: {}", e.getMessage(), e);
        }
    }
}
