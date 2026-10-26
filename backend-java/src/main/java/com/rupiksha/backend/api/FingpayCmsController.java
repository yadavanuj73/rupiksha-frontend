package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.FingpayCmsDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.FingpayCmsService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
public class FingpayCmsController {

    private final FingpayCmsService fingpayCmsService;

    /**
     * Authenticated endpoint for Retailers to initiate Fingpay CMS portal session.
     * Generates AES-encrypted launch payload and signed URL.
     */
    @PostMapping("/api/v1/fingpay-cms/launch")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<FingpayCmsDtos.LaunchResponse> launchCms(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestBody(required = false) FingpayCmsDtos.LaunchRequest request,
            HttpServletRequest httpRequest) {

        String ipAddress = resolveClientIp(httpRequest);
        log.info("CMS Launch requested by user: {} from IP: {}", principal.username(), ipAddress);

        FingpayCmsDtos.LaunchResponse response = fingpayCmsService.generateLaunchUrl(
                UUID.fromString(principal.userId()),
                request != null ? request : new FingpayCmsDtos.LaunchRequest(),
                ipAddress
        );

        return ResponseEntity.ok(response);
    }

    /**
     * Server-to-server POST callback from Fingpay for BC Wallet Debit (Initiated, Success, Failure).
     * Protected by cryptographic SHA-256 header hash validation.
     */
    @PostMapping(value = {
            "/api/v1/fingpay-cms/callback/debit",
            "/api/v1/fingpay-cms/callback/status",
            "/api/v1/fingpay-cms/callback/transaction-status",
            "/api/v1/cms/debit",
            "/api/v1/cms/status",
            "/api/v1/cms/transaction-status"
    },
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<FingpayCmsDtos.DebitCallbackResponse> handleDebitCallback(
            @RequestHeader(value = "hash", required = false) String hashHeader,
            @RequestHeader(value = "Hash", required = false) String hashHeaderCap,
            @RequestBody String rawBody,
            HttpServletRequest httpRequest) {

        String effectiveHash = (hashHeader != null && !hashHeader.isBlank()) ? hashHeader : hashHeaderCap;
        String ipAddress = resolveClientIp(httpRequest);

        log.info("Received Fingpay CMS debit callback from IP: {}", ipAddress);
        FingpayCmsDtos.DebitCallbackResponse response = fingpayCmsService.processDebitCallback(rawBody, effectiveHash, ipAddress);

        return ResponseEntity.ok(response);
    }

    /**
     * Server-to-server POST callback from Fingpay for BC Wallet Balance Check.
     * Protected by cryptographic SHA-256 header hash validation.
     */
    @PostMapping(value = {"/api/v1/fingpay-cms/callback/balance-check", "/api/v1/cms/balance-check"},
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<FingpayCmsDtos.BalanceCheckResponse> handleBalanceCheckCallback(
            @RequestHeader(value = "hash", required = false) String hashHeader,
            @RequestHeader(value = "Hash", required = false) String hashHeaderCap,
            @RequestBody String rawBody,
            HttpServletRequest httpRequest) {

        String effectiveHash = (hashHeader != null && !hashHeader.isBlank()) ? hashHeader : hashHeaderCap;
        String ipAddress = resolveClientIp(httpRequest);

        log.info("Received Fingpay CMS balance-check callback from IP: {}", ipAddress);
        FingpayCmsDtos.BalanceCheckResponse response = fingpayCmsService.processBalanceCheck(rawBody, effectiveHash, ipAddress);

        return ResponseEntity.ok(response);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
