package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AdminBankAccountDtos;
import com.rupiksha.backend.domain.AdminBankAccount;
import com.rupiksha.backend.domain.AdminBankAccountAuditLog;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.AdminBankAccountAuditLogRepository;
import com.rupiksha.backend.repository.AdminBankAccountRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.util.BankAccountEncryptionUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminBankAccountServiceImplTest {

    @Mock
    private AdminBankAccountRepository bankAccountRepository;

    @Mock
    private AdminBankAccountAuditLogRepository auditLogRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private BankAccountEncryptionUtil encryptionUtil;

    @InjectMocks
    private AdminBankAccountServiceImpl bankAccountService;

    private User adminUser;
    private UUID adminId;

    @BeforeEach
    void setUp() {
        adminId = UUID.randomUUID();
        adminUser = new User();
        adminUser.setId(adminId);
        adminUser.setUsername("admin_test");
    }

    @Test
    void createAccount_Success_EncryptsAndMasks() {
        AdminBankAccountDtos.CreateBankAccountRequest request = new AdminBankAccountDtos.CreateBankAccountRequest(
                "Rupiksha Services Pvt Ltd",
                "12345678901234",
                "HDFC0001234",
                "HDFC Bank",
                "Lucknow"
        );

        when(userRepository.findById(adminId)).thenReturn(Optional.of(adminUser));
        when(encryptionUtil.encrypt("12345678901234")).thenReturn("ENC_12345678901234");
        when(bankAccountRepository.save(any(AdminBankAccount.class))).thenAnswer(invocation -> {
            AdminBankAccount arg = invocation.getArgument(0);
            arg.setId(UUID.randomUUID());
            return arg;
        });

        AdminBankAccountDtos.BankAccountResponse response = bankAccountService.createAccount(request, adminId, "127.0.0.1");

        assertNotNull(response);
        assertEquals("Rupiksha Services Pvt Ltd", response.accountHolderName());
        assertEquals("XXXXXXXXXX1234", response.accountNumberMasked());
        assertEquals("HDFC Bank", response.bankName());
        assertTrue(response.isActive());

        verify(auditLogRepository, times(1)).save(any(AdminBankAccountAuditLog.class));
    }

    @Test
    void toggleStatus_Success_DeactivatesAccount() {
        UUID accountId = UUID.randomUUID();
        AdminBankAccount existing = AdminBankAccount.builder()
                .id(accountId)
                .accountHolderName("Rupiksha")
                .accountNumberEncrypted("ENC")
                .accountNumberMasked("XXXX1234")
                .ifscCode("ICIC0001")
                .bankName("ICICI")
                .branch("Civil Lines")
                .isActive(true)
                .build();

        when(userRepository.findById(adminId)).thenReturn(Optional.of(adminUser));
        when(bankAccountRepository.findByIdForUpdate(accountId)).thenReturn(Optional.of(existing));
        when(bankAccountRepository.save(any(AdminBankAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminBankAccountDtos.BankAccountResponse response = bankAccountService.toggleAccountStatus(accountId, false, adminId, "127.0.0.1");

        assertNotNull(response);
        assertFalse(response.isActive());
        verify(auditLogRepository, times(1)).save(any(AdminBankAccountAuditLog.class));
    }

    @Test
    void getActiveAccounts_ReturnsOnlyActive() {
        AdminBankAccount activeAccount = AdminBankAccount.builder()
                .id(UUID.randomUUID())
                .accountHolderName("Rupiksha Active")
                .accountNumberMasked("XXXX5678")
                .ifscCode("SBIN0001")
                .bankName("SBI")
                .branch("Main Branch")
                .isActive(true)
                .build();

        when(bankAccountRepository.findByIsActiveTrueOrderByCreatedAtDesc()).thenReturn(List.of(activeAccount));

        List<AdminBankAccountDtos.ActiveBankAccountResponse> activeList = bankAccountService.getActiveAccounts();

        assertEquals(1, activeList.size());
        assertEquals("Rupiksha Active", activeList.get(0).accountHolderName());
        assertEquals("XXXX5678", activeList.get(0).accountNumberMasked());
    }
}
