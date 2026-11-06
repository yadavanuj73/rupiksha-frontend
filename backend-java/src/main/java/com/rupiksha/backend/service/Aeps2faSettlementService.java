package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.CommissionDtos;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.UUID;

public interface Aeps2faSettlementService {

    /**
     * Automatically settles outstanding 2FA charges using incoming wallet credit.
     * Evaluates unsettled charges in FIFO order and records individual settlement records.
     *
     * @param userId Target user receiving credit
     * @param incomingCreditAmount The gross credit amount
     * @param incomingCreditReference Reference ID of the credit entry
     * @return Total amount applied to settle outstanding 2FA charges
     */
    BigDecimal settleOutstandingCharges(UUID userId, BigDecimal incomingCreditAmount, String incomingCreditReference);

    BigDecimal getOutstandingAmount(UUID userId);

    Page<CommissionDtos.Aeps2faSettlementDto> getSettlementHistory(UUID userId, Pageable pageable);

    Page<CommissionDtos.Aeps2faSettlementDto> getAllSettlements(Pageable pageable);
}

