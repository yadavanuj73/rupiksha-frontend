package com.rupiksha.aeps.service;

import com.rupiksha.aeps.entity.PayoutStatusHistory;
import com.rupiksha.aeps.entity.PayoutTransaction;

import java.util.List;

public interface PayoutAuditService {

    PayoutStatusHistory recordStatusChange(
            PayoutTransaction transaction,
            String previousStatus,
            String newStatus,
            String providerStatus,
            String providerTxnId,
            String utr,
            String actingPrincipal,
            String remarks
    );

    List<PayoutStatusHistory> getStatusHistory(String orderId);

    List<PayoutStatusHistory> getUserStatusHistory(String userId);
}
