package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.OtpDtos;

public interface OtpService {
    OtpDtos.OtpResponse sendOtp(OtpDtos.SendOtpRequest request);
    OtpDtos.OtpResponse verifyOtp(OtpDtos.VerifyOtpRequest request);
    OtpDtos.OtpResponse resendOtp(OtpDtos.SendOtpRequest request);
}
