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
    public ResponseEntity<AepsOnboardingResponse> onboard(@RequestBody AepsOnboardingRequest request) {
        AepsOnboardingResponse response = aepsService.onboard(request);

        // On success, persist agentId and merchantId to the users table
        if (response != null && Integer.valueOf(1).equals(response.getStatusId())) {
            try {
                String mobile = request.getAeps_mobile();
                Optional<User> userOpt = userRepository.findByMobile(mobile);
                if (userOpt.isPresent()) {
                    User user = userOpt.get();
                    user.setAepsAgentId(response.getAgentId());
                    user.setAepsMerchantId(response.getMerchantId());
                    user.setAepsOnboarded(true);
                    userRepository.save(user);
                    log.info("AEPS onboarding saved to DB for mobile: {} agentId: {}", mobile, response.getAgentId());
                } else {
                    log.warn("User not found in DB for mobile: {} — AEPS status not persisted", mobile);
                }
            } catch (Exception e) {
                log.error("Failed to save AEPS onboarding status to DB", e);
                // Don't fail the response — Levin already succeeded
            }
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Check AEPS onboarding status for a user by mobile number.
     * Frontend calls this on load to decide whether to show onboarding form.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> aepsStatus(@RequestParam String mobile) {
        try {
            Optional<User> userOpt = userRepository.findByMobile(mobile);
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                boolean onboarded = Boolean.TRUE.equals(user.getAepsOnboarded());
                return ResponseEntity.ok(Map.of(
                        "onboarded",  onboarded,
                        "agentId",    user.getAepsAgentId()    != null ? user.getAepsAgentId()    : "",
                        "merchantId", user.getAepsMerchantId() != null ? user.getAepsMerchantId() : ""
                ));
            }
            return ResponseEntity.ok(Map.of("onboarded", false, "agentId", "", "merchantId", ""));
        } catch (Exception e) {
            log.error("Error checking AEPS status", e);
            return ResponseEntity.ok(Map.of("onboarded", false, "agentId", "", "merchantId", ""));
        }
    }

    @PostMapping("/aeps-kyc")
    public ResponseEntity<?> aepsKyc(@RequestBody AepsKycRequest request) {
        return ResponseEntity.ok(aepsService.aepsKyc(request));
    }

    @PostMapping("/aeps-kyc-otp-verify")
    public ResponseEntity<?> verifyKycOtp(@RequestBody AepsKycOtpVerifyRequest request) {
        return ResponseEntity.ok(aepsService.verifyKycOtp(request));
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
