package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.WalletTransferDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.repository.WalletRepository;
import com.rupiksha.backend.repository.WalletTransferRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class WalletTransferServiceImplTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private WalletRepository walletRepository;
    @Mock
    private WalletEntryRepository walletEntryRepository;
    @Mock
    private WalletTransferRepository walletTransferRepository;

    @InjectMocks
    private WalletTransferServiceImpl walletTransferService;

    private User sender;
    private User recipient;
    private Wallet senderWallet;
    private Wallet recipientWallet;

    @BeforeEach
    void setUp() {
        Role roleRetailer = new Role();
        roleRetailer.setName(RoleName.RETAILER);

        Role roleDistributor = new Role();
        roleDistributor.setName(RoleName.DISTRIBUTOR);

        sender = new User();
        sender.setId(UUID.randomUUID());
        sender.setUsername("sender_user");
        sender.setFullName("Sender Retailer");
        sender.setMobile("9876543210");
        sender.setPartyCode("RX1001");
        sender.setStatus(UserStatus.ACTIVE);
        sender.setRoles(Set.of(roleRetailer));

        recipient = new User();
        recipient.setId(UUID.randomUUID());
        recipient.setUsername("recipient_user");
        recipient.setFullName("Recipient Distributor");
        recipient.setBusinessName("Recipient Enterprises");
        recipient.setMobile("9876543211");
        recipient.setPartyCode("RX1002");
        recipient.setStatus(UserStatus.ACTIVE);
        recipient.setRoles(Set.of(roleDistributor));

        senderWallet = new Wallet();
        senderWallet.setId(UUID.randomUUID());
        senderWallet.setUser(sender);
        senderWallet.setBalance(new BigDecimal("1000.00"));
        senderWallet.setLockedBalance(BigDecimal.ZERO);
        senderWallet.setStatus(WalletStatus.ACTIVE);

        recipientWallet = new Wallet();
        recipientWallet.setId(UUID.randomUUID());
        recipientWallet.setUser(recipient);
        recipientWallet.setBalance(new BigDecimal("500.00"));
        recipientWallet.setLockedBalance(BigDecimal.ZERO);
        recipientWallet.setStatus(WalletStatus.ACTIVE);
    }

    @Test
    void searchRecipient_success() {
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findByMobile("9876543211")).thenReturn(Optional.of(recipient));

        WalletTransferDtos.RecipientLookupResponse response = walletTransferService.searchRecipient("9876543211", sender.getId());

        assertNotNull(response);
        assertEquals("Recipient Distributor", response.fullName());
        assertEquals("9876543211", response.mobile());
        assertEquals("RX1002", response.partyCode());
        assertTrue(response.eligible());
    }

    @Test
    void searchRecipient_selfTransfer_throwsException() {
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));

        assertThrows(IllegalArgumentException.class, () -> 
                walletTransferService.searchRecipient("9876543210", sender.getId()));
    }

    @Test
    void transferFunds_success() {
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findByMobile("9876543211")).thenReturn(Optional.of(recipient));
        when(walletRepository.findByUserIdWithLock(sender.getId())).thenReturn(Optional.of(senderWallet));
        when(walletRepository.findByUserIdWithLock(recipient.getId())).thenReturn(Optional.of(recipientWallet));
        when(walletRepository.save(any(Wallet.class))).thenAnswer(i -> i.getArgument(0));
        when(walletEntryRepository.save(any(WalletEntry.class))).thenAnswer(i -> i.getArgument(0));
        when(walletTransferRepository.save(any(WalletTransfer.class))).thenAnswer(i -> i.getArgument(0));

        WalletTransferDtos.WalletTransferRequest request = new WalletTransferDtos.WalletTransferRequest(
                "9876543211",
                null,
                new BigDecimal("300.00"),
                "Settlement payment",
                "idem_123"
        );

        WalletTransferDtos.WalletTransferResponse response = walletTransferService.transferFunds(
                request,
                sender.getId(),
                "127.0.0.1",
                "idem_123"
        );

        assertNotNull(response);
        assertEquals(new BigDecimal("700.00"), senderWallet.getBalance());
        assertEquals(new BigDecimal("800.00"), recipientWallet.getBalance());
        assertEquals("SUCCESS", response.status());
        assertEquals(new BigDecimal("300.00"), response.amount());
        verify(walletEntryRepository, times(2)).save(any(WalletEntry.class));
        verify(walletTransferRepository, times(1)).save(any(WalletTransfer.class));
    }

    @Test
    void transferFunds_insufficientBalance_throwsException() {
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findByMobile("9876543211")).thenReturn(Optional.of(recipient));
        when(walletRepository.findByUserIdWithLock(sender.getId())).thenReturn(Optional.of(senderWallet));
        when(walletRepository.findByUserIdWithLock(recipient.getId())).thenReturn(Optional.of(recipientWallet));

        WalletTransferDtos.WalletTransferRequest request = new WalletTransferDtos.WalletTransferRequest(
                "9876543211",
                null,
                new BigDecimal("5000.00"),
                "Overspending",
                "idem_456"
        );

        assertThrows(IllegalArgumentException.class, () -> 
                walletTransferService.transferFunds(request, sender.getId(), "127.0.0.1", "idem_456"));

        // Balances must remain untouched
        assertEquals(new BigDecimal("1000.00"), senderWallet.getBalance());
        assertEquals(new BigDecimal("500.00"), recipientWallet.getBalance());
        verify(walletEntryRepository, never()).save(any());
        verify(walletTransferRepository, never()).save(any());
    }

    @Test
    void transferFunds_idempotencyReplay() {
        WalletTransfer existing = new WalletTransfer();
        existing.setTransferReference("W2W-20261009-ABC123");
        existing.setSender(sender);
        existing.setRecipient(recipient);
        existing.setAmount(new BigDecimal("300.00"));
        existing.setTotalDebit(new BigDecimal("300.00"));
        existing.setRecipientCredit(new BigDecimal("300.00"));
        existing.setStatus("SUCCESS");
        existing.setCompletedAt(Instant.now());

        when(walletTransferRepository.findByIdempotencyKey("idem_existing")).thenReturn(Optional.of(existing));
        when(walletRepository.findByUserId(sender.getId())).thenReturn(Optional.of(senderWallet));

        WalletTransferDtos.WalletTransferRequest request = new WalletTransferDtos.WalletTransferRequest(
                "9876543211",
                null,
                new BigDecimal("300.00"),
                "Settlement payment",
                "idem_existing"
        );

        WalletTransferDtos.WalletTransferResponse response = walletTransferService.transferFunds(
                request,
                sender.getId(),
                "127.0.0.1",
                "idem_existing"
        );

        assertNotNull(response);
        assertEquals("W2W-20261009-ABC123", response.transferReference());
        verify(walletRepository, never()).findByUserIdWithLock(any());
    }
}
