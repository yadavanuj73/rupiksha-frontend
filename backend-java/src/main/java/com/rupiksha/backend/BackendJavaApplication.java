package com.rupiksha.backend;

import com.rupiksha.aeps.config.AepsProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ComponentScan;
import java.util.TimeZone;

@SpringBootApplication
@ComponentScan(basePackages = {"com.rupiksha.backend", "com.rupiksha.aeps"})
@EnableConfigurationProperties(AepsProperties.class)
public class BackendJavaApplication {
    public static void main(String[] args) {
        // Normalize JVM timezone explicitly so the PostgreSQL JDBC startup packet
        // never sends legacy aliases like "Asia/Calcutta" on some Windows/JDK
        // combos. This keeps local and production behavior consistent.
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
        SpringApplication.run(BackendJavaApplication.class, args);
    }
}

