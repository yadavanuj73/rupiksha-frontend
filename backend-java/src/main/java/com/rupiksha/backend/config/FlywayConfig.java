package com.rupiksha.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class FlywayConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            log.info("Running Flyway repair to clear any failed migrations and align checksums...");
            flyway.repair();
            log.info("Executing Flyway migration...");
            flyway.migrate();
            log.info("Flyway migration completed successfully.");
        };
    }
}
