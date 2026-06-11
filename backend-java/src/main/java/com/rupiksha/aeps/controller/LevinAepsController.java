package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.dto.*;
import com.rupiksha.aeps.service.AepsService;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/v1/aeps")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:5173", "https://rupiksha-frontend.vercel.app", "https://rupiksha.in", "https://www.rupiksha.in"})
public class LevinAepsController {

    private final AepsService aepsService;
    private final UserRepository userRepository;

    /**
     * AEPS Onboarding — calls Levin API and saves agentId/merchantId to users table on success.
     */
    @PostMapping("/onboard")
    public ResponseEntity<AepsOnboardingResponse> onboard(
            @RequestBody AepsOnboardingRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal Object principal) {
        AepsOnboardingResponse response = aepsService.onboard(request);

        // On success or "already completed", persist status to the users table
        boolean isSuccess = response != null && (
            Integer.valueOf(1).equals(response.getStatusId()) ||
            (response.getMessage() != null && response.getMessage().toLowerCase().contains("already"))
        );

        if (isSuccess) {
            try {
                // Try to find user by: 1) logged-in user's username, 2) form mobile
                Optional<User> userOpt = Optional.empty();

                // First try: get the authenticated user from JWT
                if (principal != null) {
                    String username = null;
                    if (principal instanceof org.springframework.security.core.userdetails.UserDetails ud) {
                        username = ud.getUsername();
                    } else {
                        username = principal.toString();
                    }
                    if (username != null) {
                        userOpt = userRepository.findByUsername(username);
                    }
                }

                // Fallback: try by form mobile
                if (userOpt.isEmpty()) {
                    userOpt = userRepository.findByMobile(request.getAeps_mobile());
                }

                if (userOpt.isPresent()) {
                    User user = userOpt.get();
                    // Use agentId from response, or generate one if not provided
                    String agentId = response.getAgentId() != null ? response.getAgentId() : ("RUP0" + request.getAeps_mobile());
                    String merchantId = response.getMerchantId() != null ? response.getMerchantId() : "";
                    user.setAepsAgentId(agentId);
                    user.setAepsMerchantId(merchantId);
                    user.setAepsOnboarded(true);
                    userRepository.save(user);
                    log.info("AEPS onboarding saved to DB for user: {} agentId: {}", user.getUsername(), agentId);

                    // Also set agentId in response so frontend gets it
                    if (response.getAgentId() == null) response.setAgentId(agentId);
                    // Force statusId to 1 for "already completed" case
                    response.setStatusId(1);
                } else {
                    log.warn("User not found — AEPS status not persisted. Form mobile: {}", request.getAeps_mobile());
                }
            } catch (Exception e) {
                log.error("Failed to save AEPS onboarding status to DB", e);
            }
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Check AEPS onboarding status for a user by mobile number or username.
     * Frontend calls this on load to decide whether to show onboarding form.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> aepsStatus(@RequestParam String mobile) {
        try {
            // Try by mobile first, then by username (some users login with party code as username)
            Optional<User> userOpt = userRepository.findByMobile(mobile);
            if (userOpt.isEmpty()) {
                userOpt = userRepository.findByUsername(mobile);
            }
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                boolean onboarded = Boolean.TRUE.equals(user.getAepsOnboarded());
                boolean kycDone = Boolean.TRUE.equals(user.getAepsKycDone());
                return ResponseEntity.ok(Map.of(
                        "onboarded",  onboarded,
                        "kycDone",    kycDone,
                        "agentId",    user.getAepsAgentId()    != null ? user.getAepsAgentId()    : "",
                        "merchantId", user.getAepsMerchantId() != null ? user.getAepsMerchantId() : ""
                ));
            }
            return ResponseEntity.ok(Map.of("onboarded", false, "kycDone", false, "agentId", "", "merchantId", ""));
        } catch (Exception e) {
            log.error("Error checking AEPS status", e);
            return ResponseEntity.ok(Map.of("onboarded", false, "agentId", "", "merchantId", ""));
        }
    }

    @PostMapping("/aeps-kyc")
    public ResponseEntity<?> aepsKyc(@RequestBody AepsKycRequest request) {
        AepsKycResponse response = aepsService.aepsKyc(request);
        // Save kycDone = true on success (status_id = 1)
        if (response != null && Integer.valueOf(1).equals(response.getStatusId())) {
            try {
                userRepository.findByMobile(request.getMobile())
                    .or(() -> userRepository.findByUsername(request.getMobile()))
                    .ifPresent(user -> {
                        user.setAepsKycDone(true);
                        userRepository.save(user);
                        log.info("AEPS KYC marked done for user: {}", user.getUsername());
                    });
            } catch (Exception e) {
                log.error("Failed to save AEPS KYC done status", e);
            }
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/aeps-kyc-otp-verify")
    public ResponseEntity<?> verifyKycOtp(@RequestBody AepsKycOtpVerifyRequest request) {
        AepsKycOtpVerifyResponse response = aepsService.verifyKycOtp(request);
        // Save kycDone = true on OTP verify success (status_id = 1)
        if (response != null && Integer.valueOf(1).equals(response.getStatusId())) {
            try {
                userRepository.findByMobile(request.getContactNumber())
                    .or(() -> userRepository.findByUsername(request.getContactNumber()))
                    .ifPresent(user -> {
                        user.setAepsKycDone(true);
                        userRepository.save(user);
                        log.info("AEPS KYC (OTP) marked done for user: {}", user.getUsername());
                    });
            } catch (Exception e) {
                log.error("Failed to save AEPS KYC OTP done status", e);
            }
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/aeps-twofa")
    public ResponseEntity<AepsTwoFaResponse> aepsTwoFa(@RequestBody AepsTwoFaRequest request) {
        try {
            log.info("AEPS 2FA Request Received : {}", request);
            AepsTwoFaResponse response = aepsService.aepsTwoFa(request);
            log.info("AEPS 2FA Response : {}", response);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("AEPS 2FA Controller Error", e);
            AepsTwoFaResponse error = new AepsTwoFaResponse();
            error.setStatusId(2);
            error.setMessage("AEPS 2FA Failed");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @PostMapping("/transaction")
    public ResponseEntity<AepsTransactionResponse> transaction(@RequestBody AepsTransactionRequest request) {
        try {
            String maskedAadhar = request.getAdharNumber() != null ?
                    request.getAdharNumber().replaceAll("\\d(?=\\d{4})", "*") : null;

            log.info("=========== AEPS TRANSACTION API ===========");
            log.info("Mobile : {}", request.getMobileNumber());
            log.info("Aadhar : {}", maskedAadhar);
            log.info("Bank : {}", request.getAepsBankName());
            log.info("Method : {}", request.getAepsMethod());

            AepsTransactionResponse response = aepsService.aepsTransaction(request);
            log.info("AEPS Transaction Response : {}", response);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("AEPS Transaction Error", e);
            AepsTransactionResponse error = new AepsTransactionResponse();
            error.setStatusId(0);
            error.setStatus("FAILED");
            error.setErrorCode("INTERNAL_ERROR");
            error.setMessage("AEPS Transaction Failed");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @PostMapping("/transaction-status")
    public ResponseEntity<AepsTransactionStatusResponse> status(@RequestBody AepsTransactionStatusRequest request) {
        return ResponseEntity.ok(aepsService.transactionStatus(request));
    }
}
