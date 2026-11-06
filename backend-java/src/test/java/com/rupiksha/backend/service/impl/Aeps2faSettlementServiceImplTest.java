package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.domain.Aeps2faChargeSettlement;
import com.rupiksha.backend.domain.Aeps2faChargeTxn;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.Aeps2faChargeSettlementRepository;
import com.rupiksha.backend.repository.Aeps2faChargeTxnRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class Aeps2faSettlementServiceImplTest {

    @Mock
    private Aeps2faChargeTxnRepository chargeTxnRepository;

    @Mock
    private Aeps2faChargeSettlementRepository settlementRepository;

    @InjectMocks
    private Aeps2faSettlementServiceImpl settlementService;

    private User testUser;
    private UUID testUserId;

    @BeforeEach
    void setUp() {
        testUserId = UUID.randomUUID();
        testUser = new User();
        testUser.setId(testUserId);
        testUser.setUsername("test_agent");
        testUser.setFullName("Test Agent");
    }

    @Test
    @DisplayName("Zero incoming credit returns zero and does nothing")
    void testSettleOutstandingCharges_ZeroIncomingCredit() {
        BigDecimal settled = settlementService.settleOutstandingCharges(testUserId, BigDecimal.ZERO, "CREDIT-001");
        assertEquals(BigDecimal.ZERO, settled);
        verify(chargeTxnRepository, never()).findUnsettledByUserIdForUpdate(any());
    }

    @Test
    @DisplayName("No unsettled 2FA charges returns zero")
    void testSettleOutstandingCharges_NoUnsettledCharges() {
        when(chargeTxnRepository.findUnsettledByUserIdForUpdate(testUserId)).thenReturn(Collections.emptyList());

        BigDecimal settled = settlementService.settleOutstandingCharges(testUserId, new BigDecimal("100.00"), "CREDIT-002");
        assertEquals(BigDecimal.ZERO, settled);
        verify(settlementRepository, never()).save(any());
    }

    @Test
    @DisplayName("Full settlement of single charge: ₹3.00 outstanding + ₹100.00 credit settles ₹3.00 (remaining ₹0, status SETTLED)")
    void testSettleOutstandingCharges_FullSettlementSingleCharge() {
        Aeps2faChargeTxn charge = Aeps2faChargeTxn.builder()
                .id(UUID.randomUUID())
                .chargeReference("2FA-CHG-1001")
                .user(testUser)
                .amountCharged(new BigDecimal("5.00"))
                .walletClosingBalance(new BigDecimal("-3.00"))
                .outstandingAmount(new BigDecimal("3.00"))
                .settlementStatus("UNSETTLED")
                .build();

        when(chargeTxnRepository.findUnsettledByUserIdForUpdate(testUserId)).thenReturn(List.of(charge));

        BigDecimal totalSettled = settlementService.settleOutstandingCharges(testUserId, new BigDecimal("100.00"), "COMM-CREDIT-999");

        assertEquals(new BigDecimal("3.00"), totalSettled);
        assertEquals(new BigDecimal("0.00"), charge.getOutstandingAmount());
        assertEquals("SETTLED", charge.getSettlementStatus());
        verify(chargeTxnRepository).save(charge);

        ArgumentCaptor<Aeps2faChargeSettlement> captor = ArgumentCaptor.forClass(Aeps2faChargeSettlement.class);
        verify(settlementRepository).save(captor.capture());
        Aeps2faChargeSettlement settlement = captor.getValue();
        assertEquals(new BigDecimal("3.00"), settlement.getSettlementAmount());
        assertEquals(new BigDecimal("0.00"), settlement.getRemainingOutstandingAmount());
        assertEquals("COMM-CREDIT-999", settlement.getIncomingCreditReference());
        assertEquals("SETTLED", settlement.getSettlementStatus());
        assertTrue(settlement.getSettlementReference().startsWith("SETTLE-2FA-"));
    }

    @Test
    @DisplayName("Partial settlement of single charge: ₹50.00 outstanding + ₹20.00 credit settles ₹20.00 (remaining ₹30, status PARTIALLY_SETTLED)")
    void testSettleOutstandingCharges_PartialSettlementSingleCharge() {
        Aeps2faChargeTxn charge = Aeps2faChargeTxn.builder()
                .id(UUID.randomUUID())
                .chargeReference("2FA-CHG-1002")
                .user(testUser)
                .amountCharged(new BigDecimal("50.00"))
                .walletClosingBalance(new BigDecimal("-50.00"))
                .outstandingAmount(new BigDecimal("50.00"))
                .settlementStatus("UNSETTLED")
                .build();

        when(chargeTxnRepository.findUnsettledByUserIdForUpdate(testUserId)).thenReturn(List.of(charge));

        BigDecimal totalSettled = settlementService.settleOutstandingCharges(testUserId, new BigDecimal("20.00"), "FUND-REQ-001");

        assertEquals(new BigDecimal("20.00"), totalSettled);
        assertEquals(new BigDecimal("30.00"), charge.getOutstandingAmount());
        assertEquals("PARTIALLY_SETTLED", charge.getSettlementStatus());
        verify(chargeTxnRepository).save(charge);

        ArgumentCaptor<Aeps2faChargeSettlement> captor = ArgumentCaptor.forClass(Aeps2faChargeSettlement.class);
        verify(settlementRepository).save(captor.capture());
        Aeps2faChargeSettlement settlement = captor.getValue();
        assertEquals(new BigDecimal("20.00"), settlement.getSettlementAmount());
        assertEquals(new BigDecimal("30.00"), settlement.getRemainingOutstandingAmount());
        assertEquals("PARTIALLY_SETTLED", settlement.getSettlementStatus());
    }

    @Test
    @DisplayName("FIFO settlement of multiple charges: ₹10.00 + ₹15.00 outstanding with ₹20.00 credit settles #1 fully (₹10) and #2 partially (₹10)")
    void testSettleOutstandingCharges_MultipleCharges_FIFO() {
        Aeps2faChargeTxn charge1 = Aeps2faChargeTxn.builder()
                .id(UUID.randomUUID())
                .chargeReference("2FA-CHG-1010")
                .user(testUser)
                .amountCharged(new BigDecimal("10.00"))
                .walletClosingBalance(new BigDecimal("-10.00"))
                .outstandingAmount(new BigDecimal("10.00"))
                .settlementStatus("UNSETTLED")
                .build();

        Aeps2faChargeTxn charge2 = Aeps2faChargeTxn.builder()
                .id(UUID.randomUUID())
                .chargeReference("2FA-CHG-1011")
                .user(testUser)
                .amountCharged(new BigDecimal("15.00"))
                .walletClosingBalance(new BigDecimal("-25.00"))
                .outstandingAmount(new BigDecimal("15.00"))
                .settlementStatus("UNSETTLED")
                .build();

        when(chargeTxnRepository.findUnsettledByUserIdForUpdate(testUserId)).thenReturn(List.of(charge1, charge2));

        BigDecimal totalSettled = settlementService.settleOutstandingCharges(testUserId, new BigDecimal("20.00"), "ADMIN-CREDIT-55");

        assertEquals(new BigDecimal("20.00"), totalSettled);

        // Charge 1: fully settled
        assertEquals(new BigDecimal("0.00"), charge1.getOutstandingAmount());
        assertEquals("SETTLED", charge1.getSettlementStatus());

        // Charge 2: partially settled
        assertEquals(new BigDecimal("5.00"), charge2.getOutstandingAmount());
        assertEquals("PARTIALLY_SETTLED", charge2.getSettlementStatus());

        verify(chargeTxnRepository).save(charge1);
        verify(chargeTxnRepository).save(charge2);

        ArgumentCaptor<Aeps2faChargeSettlement> captor = ArgumentCaptor.forClass(Aeps2faChargeSettlement.class);
        verify(settlementRepository, times(2)).save(captor.capture());
        List<Aeps2faChargeSettlement> settlements = captor.getAllValues();
        assertEquals(2, settlements.size());

        // First settlement record
        assertEquals(new BigDecimal("10.00"), settlements.get(0).getSettlementAmount());
        assertEquals(new BigDecimal("0.00"), settlements.get(0).getRemainingOutstandingAmount());
        assertEquals("SETTLED", settlements.get(0).getSettlementStatus());

        // Second settlement record
        assertEquals(new BigDecimal("10.00"), settlements.get(1).getSettlementAmount());
        assertEquals(new BigDecimal("5.00"), settlements.get(1).getRemainingOutstandingAmount());
        assertEquals("PARTIALLY_SETTLED", settlements.get(1).getSettlementStatus());
    }
}
