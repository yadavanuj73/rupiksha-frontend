package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.OtpDtos;
import com.rupiksha.backend.service.OtpService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/otp")
@RequiredArgsConstructor
public class OtpController {
    private final OtpService otpService;

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
}

