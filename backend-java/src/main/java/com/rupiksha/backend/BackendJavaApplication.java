package com.rupiksha.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import java.util.TimeZone;

@SpringBootApplication
@ComponentScan(basePackages = {"com.rupiksha.backend", "com.rupiksha.aeps"})
@EnableJpaRepositories(basePackages = {"com.rupiksha.backend.repository", "com.rupiksha.aeps.repository"})
@EntityScan(basePackages = {"com.rupiksha.backend.domain", "com.rupiksha.aeps.entity"})
public class BackendJavaApplication {
    public static void main(String[] args) {
        // Normalize JVM timezone explicitly so the PostgreSQL JDBC startup packet
        // never sends legacy aliases like "Asia/Calcutta" on some Windows/JDK
        // combos. This keeps local and production behavior consistent.
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
        SpringApplication.run(BackendJavaApplication.class, args);
    }
}

