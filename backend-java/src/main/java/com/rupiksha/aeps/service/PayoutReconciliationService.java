package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.PayoutResponse;

import java.util.Map;

public interface PayoutReconciliationService {

    PayoutResponse reconcileTransaction(String orderId, String actorPrincipal);

    Map<String, Object> reconcileAllPending(int maxRecords, String actorPrincipal);
}
