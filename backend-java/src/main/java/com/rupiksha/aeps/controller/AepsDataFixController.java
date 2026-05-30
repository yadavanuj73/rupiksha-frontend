package com.rupiksha.aeps.controller;

import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * ONE-TIME DATA FIX CONTROLLER
 * Fixes Saurav Anand's AEPS onboarding record in DB.
 * DELETE THIS FILE after running once.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class AepsDataFixController {

    private final UserRepository userRepository;

    @GetMapping("/fix-aeps-saurav")
    public Map<String, Object> fixSauravAeps() {
        try {
            Optional<User> userOpt = userRepository.findByMobile("9679729762");
            if (userOpt.isEmpty()) {
                return Map.of("status", "ERROR", "message", "User not found with mobile 9679729762");
            }

            User user = userOpt.get();
            user.setAepsAgentId("RUP096797297625239");
            user.setAepsMerchantId("276");
            user.setAepsOnboarded(true);
            userRepository.save(user);

            log.info("Fixed AEPS onboarding for Saurav Anand - agentId: RUP096797297625239");

            return Map.of(
                "status", "SUCCESS",
                "message", "Saurav Anand AEPS record fixed",
                "mobile", "9679729762",
                "agentId", "RUP096797297625239",
                "merchantId", "276",
                "onboarded", true
            );
        } catch (Exception e) {
            log.error("Fix failed", e);
            return Map.of("status", "ERROR", "message", e.getMessage());
        }
    }
}
