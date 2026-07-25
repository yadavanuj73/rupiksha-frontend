package com.example.Rupiksha.Fingpay.controller;

import com.example.Rupiksha.Fingpay.dto.*;
import com.example.Rupiksha.Fingpay.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/aeps")
@RequiredArgsConstructor
@Slf4j
public class AepsController {

    private final OnboardService service;
    private final SendOtpService sendOtpService;
    private final ValidateOtpService validateOtpService;
    private final ResendOtpService resendOtpService;
    private final BiometricService biometricService;
    private final EkycStatusService ekycStatusService;


    @PostMapping("/onboard")
    public String onboard(@RequestBody OnboardRequestDTO dto
                          ) {
        return service.onboard(dto);
    }

    @PostMapping("/send-otp")
    public String sendOtp(@RequestBody SendOtpRequestDTO dto) {

        return sendOtpService.sendOtp(dto);

    }

    @PostMapping("/validate-otp")
    public ResponseEntity<String> validateOtp(@RequestBody ValidateOtpRequestDTO dto) {
        return ResponseEntity.ok(validateOtpService.validateOtp(dto));
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<String> resendOtp(@RequestBody ResendOtpRequestDTO dto) {
        return ResponseEntity.ok(resendOtpService.resendOtp(dto));
    }

    @PostMapping("/biometric")
    public ResponseEntity<String> biometric(@RequestBody BiometricRequestDTO dto) {
        return ResponseEntity.ok(biometricService.biometric(dto));
    }

    @GetMapping("/status/{merchantLoginId}")
    public ResponseEntity<String> checkStatus(
            @PathVariable String merchantLoginId) {

        log.info("EKYC Status Check Request for: {}", merchantLoginId);
        String response = ekycStatusService.checkStatus(merchantLoginId);
        return ResponseEntity.ok(response);
    }
}

