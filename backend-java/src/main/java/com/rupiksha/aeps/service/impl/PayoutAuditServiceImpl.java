package com.rupiksha.aeps.service.impl;

import com.rupiksha.aeps.entity.PayoutStatusHistory;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.PayoutStatusHistoryRepository;
import com.rupiksha.aeps.service.PayoutAuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutAuditServiceImpl implements PayoutAuditService {

    private final PayoutStatusHistoryRepository payoutStatusHistoryRepository;

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public PayoutStatusHistory recordStatusChange(
            PayoutTransaction transaction,
            String previousStatus,
            String newStatus,
            String providerStatus,
            String providerTxnId,
            String utr,
            String actingPrincipal,
            String remarks
    ) {
        if (transaction == null) {
            log.warn("Cannot record payout status history: transaction is null");
            return null;
        }

        try {
            PayoutStatusHistory history = PayoutStatusHistory.builder()
                    .payoutTransactionId(transaction.getId() != null ? transaction.getId() : 0L)
                    .orderId(transaction.getOrderId())
                    .userId(transaction.getUserId())
                    .previousStatus(previousStatus)
                    .newStatus(newStatus)
                    .providerStatus(providerStatus)
                    .providerTxnId(providerTxnId != null ? providerTxnId : transaction.getProviderTxnId())
                    .utr(utr != null ? utr : transaction.getUtr())
                    .amount(transaction.getAmount())
                    .chargeAmount(transaction.getChargeAmount())
                    .totalDeducted(transaction.getTotalDeductedAmount())
                    .actingPrincipal(actingPrincipal != null ? actingPrincipal : "SYSTEM")
                    .remarks(remarks)
                    .createdAt(LocalDateTime.now())
                    .build();

            PayoutStatusHistory saved = payoutStatusHistoryRepository.save(history);
            log.info("[FINANCIAL_AUDIT] PAYOUT_STATUS_TRANSITION: orderId={}, oldStatus={}, newStatus={}, providerStatus={}, utr={}, actingPrincipal={}",
                    transaction.getOrderId(), previousStatus, newStatus, providerStatus, utr, actingPrincipal);
            return saved;
        } catch (Exception e) {
            log.error("[FINANCIAL_AUDIT_ERROR] Failed to save payout status history for orderId {}: {}",
                    transaction.getOrderId(), e.getMessage(), e);
            return null;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<PayoutStatusHistory> getStatusHistory(String orderId) {
        return payoutStatusHistoryRepository.findByOrderIdOrderByCreatedAtDesc(orderId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PayoutStatusHistory> getUserStatusHistory(String userId) {
        return payoutStatusHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
