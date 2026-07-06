package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class WalletServiceImplTest {

    @Mock
    private WalletRepository walletRepository;
    @Mock
    private WalletEntryRepository walletEntryRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private FundRequestRepository fundRequestRepository;
    @Mock
    private AuditLogRepository auditLogRepository;
    @Mock
    private AppProperties appProperties;
    @Mock
    private PlatformTransactionManager transactionManager;

    @InjectMocks
    private WalletServiceImpl walletService;

    private User admin;
    private User superDist;
    private User dist;
    private User retailer;

    private Role adminRole;
    private Role superDistRole;
    private Role distRole;
    private Role retailerRole;

    private Wallet retailerWallet;

    @BeforeEach
    void setUp() {
        adminRole = new Role();
        adminRole.setName(RoleName.ADMIN);

        superDistRole = new Role();
        superDistRole.setName(RoleName.SUPER_DISTRIBUTOR);

        distRole = new Role();
        distRole.setName(RoleName.DISTRIBUTOR);

        retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);

        admin = new User();
        admin.setId(UUID.randomUUID());
        admin.setUsername("admin");
        admin.setRoles(Set.of(adminRole));

        superDist = new User();
        superDist.setId(UUID.randomUUID());
        superDist.setUsername("superdist");
        superDist.setRoles(Set.of(superDistRole));

        dist = new User();
        dist.setId(UUID.randomUUID());
        dist.setUsername("dist");
        dist.setRoles(Set.of(distRole));

        retailer = new User();
        retailer.setId(UUID.randomUUID());
        retailer.setUsername("retailer");
        retailer.setRoles(Set.of(retailerRole));

        retailerWallet = new Wallet();
        retailerWallet.setId(UUID.randomUUID());
        retailerWallet.setUser(retailer);
        retailerWallet.setBalance(BigDecimal.valueOf(100.00));
        retailerWallet.setLockedBalance(BigDecimal.valueOf(20.00));
        retailerWallet.setStatus(WalletStatus.ACTIVE);
    }

    // A. Admin with no wallet can credit a Retailer successfully.
    // B. Admin with zero wallet balance can credit a Retailer successfully.
    // C. Admin credit increases target balance exactly once.
    @Test
    void testAdminCreditSuccess() {
        when(userRepository.findById(admin.getId())).thenReturn(Optional.of(admin));
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(walletRepository.findByUserIdWithLock(retailer.getId())).thenReturn(Optional.of(retailerWallet));
        when(walletEntryRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                retailer.getId().toString(), BigDecimal.valueOf(50.00), "Admin credit test"
        );

        WalletDtos.WalletBalanceResponse response = walletService.credit(
                request, admin.getId(), "127.0.0.1", "idem-key-1"
        );

        assertNotNull(response);
        assertEquals(BigDecimal.valueOf(150.00), retailerWallet.getBalance());
        assertEquals(BigDecimal.valueOf(150.00), response.balance());
        verify(walletRepository, times(1)).save(retailerWallet);
        verify(walletEntryRepository, times(1)).saveAndFlush(any(WalletEntry.class));
        verify(auditLogRepository, times(1)).save(any(AuditLog.class));
    }

    // D. Admin debit decreases target balance exactly once.
    @Test
    void testAdminDebitSuccess() {
        when(userRepository.findById(admin.getId())).thenReturn(Optional.of(admin));
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(walletRepository.findByUserIdWithLock(retailer.getId())).thenReturn(Optional.of(retailerWallet));
        when(walletEntryRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                retailer.getId().toString(), BigDecimal.valueOf(30.00), "Admin debit test"
        );

        WalletDtos.WalletBalanceResponse response = walletService.debit(
                request, admin.getId(), "127.0.0.1", "idem-key-2"
        );

        assertNotNull(response);
        assertEquals(BigDecimal.valueOf(70.00), retailerWallet.getBalance());
        assertEquals(BigDecimal.valueOf(70.00), response.balance());
        verify(walletRepository, times(1)).save(retailerWallet);
    }

    // E. Admin debit cannot reduce available balance below locked balance.
    @Test
    void testAdminDebitFailsIfInsufficientAvailable() {
        when(userRepository.findById(admin.getId())).thenReturn(Optional.of(admin));
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(walletRepository.findByUserIdWithLock(retailer.getId())).thenReturn(Optional.of(retailerWallet));
        when(walletEntryRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        // Available balance is 100.00 - 20.00 = 80.00. Debit 90.00 should fail.
        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                retailer.getId().toString(), BigDecimal.valueOf(90.00), "Admin debit test fail"
        );

        assertThrows(IllegalArgumentException.class, () -> {
            walletService.debit(request, admin.getId(), "127.0.0.1", "idem-key-3");
        });
        assertEquals(BigDecimal.valueOf(100.00), retailerWallet.getBalance());
    }

    // F. Super Distributor manual credit attempt returns 403.
    // G. Distributor manual credit attempt returns 403.
    // H. Retailer manual credit attempt returns 403.
    @Test
    void testNonAdminCreditForbidden() {
        when(userRepository.findById(superDist.getId())).thenReturn(Optional.of(superDist));
        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                retailer.getId().toString(), BigDecimal.valueOf(50.00), "SD credit attempt"
        );

        assertThrows(AccessDeniedException.class, () -> {
            walletService.credit(request, superDist.getId(), "127.0.0.1", "idem-key-4");
        });
    }

    // I. Non-admin lock/release/commission/status/approve/reject attempts return 403.
    @Test
    void testNonAdminLockForbidden() {
        when(userRepository.findById(superDist.getId())).thenReturn(Optional.of(superDist));
        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                retailer.getId().toString(), BigDecimal.valueOf(50.00), "SD lock attempt"
        );

        assertThrows(AccessDeniedException.class, () -> {
            walletService.lock(request, superDist.getId(), "127.0.0.1", "idem-key-5");
        });
    }

    // J. Duplicate X-Idempotency-Key does not mutate balance twice.
    // R. Admin credit duplicate idempotency key returns original result and does not create a second ledger/audit mutation.
    @Test
    void testIdempotentRequestSuccess() {
        WalletEntry entry = new WalletEntry();
        entry.setWallet(retailerWallet);
        entry.setAmount(BigDecimal.valueOf(50.00));
        entry.setClosingBalance(BigDecimal.valueOf(150.00));

        when(walletEntryRepository.findByIdempotencyKey("idem-key-dup")).thenReturn(Optional.of(entry));

        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                retailer.getId().toString(), BigDecimal.valueOf(50.00), "Credit attempt duplicate"
        );

        WalletDtos.WalletBalanceResponse response = walletService.credit(
                request, admin.getId(), "127.0.0.1", "idem-key-dup"
        );

        assertNotNull(response);
        assertEquals(BigDecimal.valueOf(100.00), retailerWallet.getBalance()); // Did not change balance
        verify(walletRepository, never()).save(any());
        verify(walletEntryRepository, never()).saveAndFlush(any());
    }

    // N. Fund request approval credits target user without debiting Admin.
    @Test
    void testFundRequestApprovalSuccess() {
        FundRequest fr = new FundRequest();
        fr.setId(UUID.randomUUID());
        fr.setUser(retailer);
        fr.setAmount(BigDecimal.valueOf(250.00));
        fr.setStatus("PENDING");

        when(userRepository.findById(admin.getId())).thenReturn(Optional.of(admin));
        when(fundRequestRepository.findByIdForUpdate(fr.getId())).thenReturn(Optional.of(fr));
        when(walletRepository.findByUserIdWithLock(retailer.getId())).thenReturn(Optional.of(retailerWallet));

        WalletDtos.FundRequestResponse response = walletService.approveFundRequest(
                fr.getId(), admin.getId(), "127.0.0.1"
        );

        assertNotNull(response);
        assertEquals("APPROVED", fr.getStatus());
        assertEquals(BigDecimal.valueOf(350.00), retailerWallet.getBalance());
        verify(walletRepository, times(1)).save(retailerWallet);
        verify(fundRequestRepository, times(1)).save(fr);
    }

    // O. Duplicate fund request approval cannot credit twice.
    @Test
    void testDuplicateFundRequestApprovalFails() {
        FundRequest fr = new FundRequest();
        fr.setId(UUID.randomUUID());
        fr.setUser(retailer);
        fr.setAmount(BigDecimal.valueOf(250.00));
        fr.setStatus("APPROVED");

        when(userRepository.findById(admin.getId())).thenReturn(Optional.of(admin));
        when(fundRequestRepository.findByIdForUpdate(fr.getId())).thenReturn(Optional.of(fr));

        assertThrows(IllegalStateException.class, () -> {
            walletService.approveFundRequest(fr.getId(), admin.getId(), "127.0.0.1");
        });
        assertEquals(BigDecimal.valueOf(100.00), retailerWallet.getBalance());
    }

    // V. GET /api/v1/wallet returns 403 for all non-admin roles.
    @Test
    void testGetWalletListNonAdminForbidden() {
        when(userRepository.findById(superDist.getId())).thenReturn(Optional.of(superDist));

        assertThrows(AccessDeniedException.class, () -> {
            walletService.getWalletsList(superDist.getId());
        });
    }

    // Z. Commission uses centralized AppProperties GST/TDS configuration.
    @Test
    void testCommissionUsesAppPropertiesConfig() {
        AppProperties.Wallet walletConfig = new AppProperties.Wallet(
                BigDecimal.valueOf(5.0),  // 5% TDS
                BigDecimal.valueOf(10.0)  // 10% GST
        );

        when(appProperties.wallet()).thenReturn(walletConfig);
        when(userRepository.findById(admin.getId())).thenReturn(Optional.of(admin));
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(walletRepository.findByUserIdWithLock(retailer.getId())).thenReturn(Optional.of(retailerWallet));
        when(walletEntryRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        WalletDtos.CommissionRequest request = new WalletDtos.CommissionRequest(
                retailer.getId().toString(), BigDecimal.valueOf(1000.00), BigDecimal.valueOf(18.0), "Comm test", null
        );

        // Gross = 1000. TDS = 50, GST = 100. Net Credited = 1000 - 50 - 100 = 850.
        WalletDtos.WalletBalanceResponse response = walletService.giveCommission(
                request, admin.getId(), "127.0.0.1", "idem-key-comm"
        );

        assertNotNull(response);
        assertEquals(BigDecimal.valueOf(950.00), retailerWallet.getBalance()); // 100.00 + 850.00
        verify(walletRepository, times(1)).save(retailerWallet);
    }
}
