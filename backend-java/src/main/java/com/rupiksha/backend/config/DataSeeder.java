package com.rupiksha.backend.config;

import com.rupiksha.backend.domain.Role;
import com.rupiksha.backend.domain.RoleName;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.UserStatus;
import com.rupiksha.backend.repository.RoleRepository;
import com.rupiksha.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    private static final String DEFAULT_DEV_ADMIN_PASSWORD = "Admin@123";

    @Override
    public void run(String... args) {
        Arrays.stream(RoleName.values()).forEach(roleName ->
                roleRepository.findByName(roleName).orElseGet(() -> {
                    Role role = new Role();
                    role.setName(roleName);
                    return roleRepository.save(role);
                })
        );

        if (userRepository.findByUsername("admin").isPresent()) {
            return;
        }

        boolean prod = List.of(environment.getActiveProfiles()).contains("prod");
        // In prod, require ADMIN_SEED_PASSWORD to be explicitly provided via env.
        // In dev, fall back to the well-known dev password so local smoke tests keep working.
        String seedPassword = environment.getProperty("ADMIN_SEED_PASSWORD");
        if (seedPassword == null || seedPassword.isBlank()) {
            if (prod) {
                log.warn("Admin user not seeded: set ADMIN_SEED_PASSWORD env var to bootstrap the first admin in production.");
                return;
            }
            seedPassword = DEFAULT_DEV_ADMIN_PASSWORD;
            log.info("Seeding dev admin user with the well-known default password. CHANGE THIS before going live.");
        }

        Role adminRole = roleRepository.findByName(RoleName.ADMIN).orElseThrow();
        User admin = new User();
        admin.setUsername("admin");
        admin.setFullName("System Admin");
        admin.setMobile("9999999999");
        admin.setEmail("admin@rupiksha.local");
        admin.setPasswordHash(passwordEncoder.encode(seedPassword));
        admin.setStatus(UserStatus.ACTIVE);
        admin.getRoles().add(adminRole);
        userRepository.save(admin);
        log.info("Created initial admin user (username=admin). Change the password immediately.");
    }
}
