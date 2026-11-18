package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.OtpDtos;
import com.rupiksha.backend.service.OtpService;
import com.rupiksha.backend.service.SmsDeliveryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/otp")
@RequiredArgsConstructor
public class OtpController {
    private final OtpService otpService;
    private final SmsDeliveryService smsDeliveryService;

    @PostMapping("/send")
    public OtpDtos.OtpResponse send(@Valid @RequestBody OtpDtos.SendOtpRequest request) {
        return otpService.sendOtp(request);
    }

    @PostMapping("/verify")
    public OtpDtos.OtpResponse verify(@Valid @RequestBody OtpDtos.VerifyOtpRequest request) {
        return otpService.verifyOtp(request);
    }

    @PostMapping("/resend")
    public OtpDtos.OtpResponse resend(@Valid @RequestBody OtpDtos.SendOtpRequest request) {
        return otpService.resendOtp(request);
    }

    @PostMapping("/callback/dovesoft")
    public ResponseEntity<Map<String, Object>> handleDoveSoftCallbackPost(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(required = false) Map<String, String> queryParams
    ) {
        Map<String, Object> combined = new HashMap<>();
        if (queryParams != null) combined.putAll(queryParams);
        if (body != null) combined.putAll(body);
        log.info("Received DoveSoft SMS delivery callback POST: {}", combined);
        smsDeliveryService.handleDeliveryCallback(combined);
        return ResponseEntity.ok(Map.of("status", "success"));
    }

    @GetMapping("/callback/dovesoft")
    public ResponseEntity<Map<String, Object>> handleDoveSoftCallbackGet(
            @RequestParam Map<String, String> queryParams
    ) {
        log.info("Received DoveSoft SMS delivery callback GET: {}", queryParams);
        smsDeliveryService.handleDeliveryCallback(queryParams);
        return ResponseEntity.ok(Map.of("status", "success"));
    }
}
