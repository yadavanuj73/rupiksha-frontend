package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.BbpsDtos;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface BbpsService {
    List<BbpsDtos.OperatorInfo> getMobilePrepaidOperators();
    List<BbpsDtos.PlanInfo> getRechargePlans(String billerId, String circle);
    BbpsDtos.RechargeResponse recharge(UUID userId, BbpsDtos.RechargeRequest request, String clientIp);
    BbpsDtos.RechargeResponse checkStatus(UUID userId, String txnId);
    BbpsDtos.RechargeResponse reconcile(UUID userId, String txnId);
    BbpsDtos.HistoryResponse getHistory(UUID userId, String status, String search, Instant startDate, Instant endDate, Pageable pageable);
    void handlePushNotification(String encResponse);
}
