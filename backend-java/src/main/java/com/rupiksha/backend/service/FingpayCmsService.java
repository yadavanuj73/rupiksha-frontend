package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.FingpayCmsDtos;

import java.util.UUID;

public interface FingpayCmsService {

    FingpayCmsDtos.LaunchResponse generateLaunchUrl(UUID userId, FingpayCmsDtos.LaunchRequest request, String ipAddress);

    FingpayCmsDtos.DebitCallbackResponse processDebitCallback(String rawBody, String hashHeader, String ipAddress);

    FingpayCmsDtos.BalanceCheckResponse processBalanceCheck(String rawBody, String hashHeader, String ipAddress);
}
