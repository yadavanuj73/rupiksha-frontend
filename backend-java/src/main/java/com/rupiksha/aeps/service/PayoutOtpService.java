package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.*;
import com.rupiksha.aeps.entity.PayoutOtpChallenge;

public interface PayoutOtpService {

    PayoutOtpSendResponse sendOtp(PayoutOtpSendRequest request, String rawUserId, String clientIp, String userAgent);

    PayoutOtpVerifyResponse verifyOtp(PayoutOtpVerifyRequest request, String rawUserId, String clientIp, String userAgent);

    PayoutOtpChallenge validateAndConsumeAuthorization(String authorizationReference, PayoutRequest request, String rawUserId, String clientIp);

    String computePayloadFingerprint(String userId, String accountNumber, String ifsc, java.math.BigDecimal amount, String transferMode);
}
