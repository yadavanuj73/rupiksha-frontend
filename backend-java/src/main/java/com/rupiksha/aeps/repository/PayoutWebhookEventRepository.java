package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.PayoutWebhookEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PayoutWebhookEventRepository extends JpaRepository<PayoutWebhookEvent, Long> {

    Optional<PayoutWebhookEvent> findFirstByPayloadHashAndProcessingStatus(String payloadHash, String processingStatus);

    Optional<PayoutWebhookEvent> findFirstByEventIdAndProcessingStatus(String eventId, String processingStatus);

    List<PayoutWebhookEvent> findByOrderIdOrderByCreatedAtDesc(String orderId);

    Page<PayoutWebhookEvent> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
