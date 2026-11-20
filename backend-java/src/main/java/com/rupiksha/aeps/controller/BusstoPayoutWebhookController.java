package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.dto.BusstoWebhookResponse;
import com.rupiksha.aeps.entity.PayoutWebhookEvent;
import com.rupiksha.aeps.service.BusstoPayoutWebhookService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
public class BusstoPayoutWebhookController {

    private final BusstoPayoutWebhookService busstoPayoutWebhookService;

    /**
     * Dedicated public HTTPS webhook endpoint for Bussto payout callbacks.
     * Accessible without user JWT authentication; protected via AES-256-GCM / Webhook Secret / S2S inquiry.
     */
    @PostMapping("/api/v1/webhooks/bussto/payout")
    public ResponseEntity<BusstoWebhookResponse> handleBusstoPayoutWebhook(
            @RequestBody(required = false) String rawPayload,
            @RequestHeader HttpHeaders headers,
            HttpServletRequest request
    ) {
        String clientIp = extractClientIp(request);
        log.info("[BUSSTO_WEBHOOK] Incoming payout callback from IP: {}", clientIp);
        return busstoPayoutWebhookService.processWebhook(rawPayload, headers, clientIp);
    }

    /**
     * Admin audit & monitoring endpoint for investigating Bussto webhook callbacks and telemetry.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/api/v1/admin/payout/webhooks")
    public ResponseEntity<Page<PayoutWebhookEvent>> getRecentWebhookEvents(
            @PageableDefault(size = 20) Pageable pageable
    ) {
        Page<PayoutWebhookEvent> events = busstoPayoutWebhookService.getRecentWebhookEvents(pageable);
        return ResponseEntity.ok(events);
    }

    private String extractClientIp(HttpServletRequest request) {
        if (request == null) return "127.0.0.1";
        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank()) {
            if (ip.contains(",")) {
                ip = ip.split(",")[0].trim();
            }
            return ip;
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
