package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.CommissionDtos;
import com.rupiksha.backend.domain.Aeps2faChargeSettlement;
import com.rupiksha.backend.domain.Aeps2faChargeTxn;
import com.rupiksha.backend.repository.Aeps2faChargeSettlementRepository;
import com.rupiksha.backend.repository.Aeps2faChargeTxnRepository;
import com.rupiksha.backend.service.Aeps2faSettlementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class Aeps2faSettlementServiceImpl implements Aeps2faSettlementService {

    private final Aeps2faChargeTxnRepository chargeTxnRepository;
    private final Aeps2faChargeSettlementRepository settlementRepository;

    @Override
    @Transactional
    public BigDecimal settleOutstandingCharges(UUID userId, BigDecimal incomingCreditAmount, String incomingCreditReference) {
        if (incomingCreditAmount == null || incomingCreditAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        List<Aeps2faChargeTxn> unsettled = chargeTxnRepository.findUnsettledByUserIdForUpdate(userId);
        if (unsettled.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal remainingCredit = incomingCreditAmount;
        BigDecimal totalSettled = BigDecimal.ZERO;

        for (Aeps2faChargeTxn charge : unsettled) {
            BigDecimal needed = charge.getOutstandingAmount();
            if (needed == null || needed.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            BigDecimal settleNow = remainingCredit.min(needed);
            if (settleNow.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal remainingOutstanding = needed.subtract(settleNow);
                charge.setOutstandingAmount(remainingOutstanding);
                if (remainingOutstanding.compareTo(BigDecimal.ZERO) == 0) {
                    charge.setSettlementStatus("SETTLED");
                } else {
                    charge.setSettlementStatus("PARTIALLY_SETTLED");
                }
                chargeTxnRepository.save(charge);

                String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
                String randStr = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
                String settleRef = "SETTLE-2FA-" + dateStr + "-" + randStr;

                Aeps2faChargeSettlement settlement = Aeps2faChargeSettlement.builder()
                        .settlementReference(settleRef)
                        .chargeTxn(charge)
                        .incomingCreditReference(incomingCreditReference != null ? incomingCreditReference : "CREDIT")
                        .user(charge.getUser())
                        .settlementAmount(settleNow)
                        .remainingOutstandingAmount(remainingOutstanding)
                        .settlementStatus(charge.getSettlementStatus())
                        .build();
                settlementRepository.save(settlement);

                totalSettled = totalSettled.add(settleNow);
                remainingCredit = remainingCredit.subtract(settleNow);

                log.info("Auto-settled 2FA charge {}: settled ₹{}, remaining outstanding ₹{} on incoming ref {}",
                        charge.getChargeReference(), settleNow, remainingOutstanding, incomingCreditReference);

                if (remainingCredit.compareTo(BigDecimal.ZERO) <= 0) {
                    break;
                }
            }
        }

        return totalSettled;
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getOutstandingAmount(UUID userId) {
        BigDecimal sum = chargeTxnRepository.sumOutstandingAmountByUserId(userId);
        return sum != null ? sum : BigDecimal.ZERO;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommissionDtos.Aeps2faSettlementDto> getSettlementHistory(UUID userId, Pageable pageable) {
        return settlementRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::mapToDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommissionDtos.Aeps2faSettlementDto> getAllSettlements(Pageable pageable) {
        return settlementRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(this::mapToDto);
    }

    private CommissionDtos.Aeps2faSettlementDto mapToDto(Aeps2faChargeSettlement s) {
        return new CommissionDtos.Aeps2faSettlementDto(
                s.getId(),
                s.getSettlementReference(),
                s.getChargeTxn().getId(),
                s.getChargeTxn().getChargeReference(),
                s.getIncomingCreditReference(),
                s.getUser().getId(),
                s.getUser().getUsername(),
                s.getSettlementAmount(),
                s.getRemainingOutstandingAmount(),
                s.getSettlementStatus(),
                s.getCreatedAt()
        );
    }
}

