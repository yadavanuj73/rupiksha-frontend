package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.BusstoWebhookResponse;
import com.rupiksha.aeps.entity.PayoutWebhookEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

public interface BusstoPayoutWebhookService {

    /**
     * Authenticates, deduplicates, validates, and processes incoming Bussto payout webhook callbacks.
     */
    ResponseEntity<BusstoWebhookResponse> processWebhook(String rawPayload, HttpHeaders headers, String clientIp);

    /**
     * Admin query of recent webhook events for auditing, reconciliation, and troubleshooting.
     */
    Page<PayoutWebhookEvent> getRecentWebhookEvents(Pageable pageable);
}
