package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AdminBankAccountDtos;
import com.rupiksha.backend.domain.AdminBankAccount;
import com.rupiksha.backend.domain.AdminBankAccountAuditLog;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.AdminBankAccountAuditLogRepository;
import com.rupiksha.backend.repository.AdminBankAccountRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.service.AdminBankAccountService;
import com.rupiksha.backend.util.BankAccountEncryptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminBankAccountServiceImpl implements AdminBankAccountService {

    private final AdminBankAccountRepository bankAccountRepository;
    private final AdminBankAccountAuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final BankAccountEncryptionUtil encryptionUtil;

    @Override
    @Transactional
    public AdminBankAccountDtos.BankAccountResponse createAccount(
            AdminBankAccountDtos.CreateBankAccountRequest request, UUID adminId, String ipAddress) {

        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin user not found"));

        String rawAccount = request.accountNumber().trim();
        String encryptedAccount = encryptionUtil.encrypt(rawAccount);
        String maskedAccount = BankAccountEncryptionUtil.maskAccountNumber(rawAccount);

        AdminBankAccount account = AdminBankAccount.builder()
                .accountHolderName(request.accountHolderName().trim())
                .accountNumberEncrypted(encryptedAccount)
                .accountNumberMasked(maskedAccount)
                .ifscCode(request.ifscCode().trim().toUpperCase())
                .bankName(request.bankName().trim())
                .branch(request.branch().trim())
                .isActive(true)
                .createdBy(admin)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        AdminBankAccount saved = bankAccountRepository.save(account);

        AdminBankAccountAuditLog audit = AdminBankAccountAuditLog.builder()
                .bankAccount(saved)
                .actionType("CREATED")
                .admin(admin)
                .details("Bank account created: " + saved.getBankName() + " (" + saved.getAccountNumberMasked() + ")")
                .ipAddress(ipAddress)
                .createdAt(Instant.now())
                .build();
        auditLogRepository.save(audit);

        log.info("Admin {} created receiving bank account {} ({}) from IP {}",
                admin.getUsername(), saved.getBankName(), saved.getAccountNumberMasked(), ipAddress);

        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminBankAccountDtos.BankAccountResponse> getAllAccounts() {
        return bankAccountRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public AdminBankAccountDtos.BankAccountResponse getAccountById(UUID id) {
        AdminBankAccount account = bankAccountRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Bank account not found"));
        return toResponse(account);
    }

    @Override
    @Transactional
    public AdminBankAccountDtos.BankAccountResponse updateAccount(
            UUID id, AdminBankAccountDtos.UpdateBankAccountRequest request, UUID adminId, String ipAddress) {

        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin user not found"));

        AdminBankAccount account = bankAccountRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Bank account not found"));

        account.setAccountHolderName(request.accountHolderName().trim());
        account.setIfscCode(request.ifscCode().trim().toUpperCase());
        account.setBankName(request.bankName().trim());
        account.setBranch(request.branch().trim());

        if (request.accountNumber() != null && !request.accountNumber().isBlank()) {
            String rawAccount = request.accountNumber().trim();
            account.setAccountNumberEncrypted(encryptionUtil.encrypt(rawAccount));
            account.setAccountNumberMasked(BankAccountEncryptionUtil.maskAccountNumber(rawAccount));
        }

        account.setUpdatedAt(Instant.now());
        AdminBankAccount saved = bankAccountRepository.save(account);

        AdminBankAccountAuditLog audit = AdminBankAccountAuditLog.builder()
                .bankAccount(saved)
                .actionType("UPDATED")
                .admin(admin)
                .details("Bank account updated: " + saved.getBankName() + " (" + saved.getAccountNumberMasked() + ")")
                .ipAddress(ipAddress)
                .createdAt(Instant.now())
                .build();
        auditLogRepository.save(audit);

        log.info("Admin {} updated bank account {} ({}) from IP {}",
                admin.getUsername(), saved.getBankName(), saved.getAccountNumberMasked(), ipAddress);

        return toResponse(saved);
    }

    @Override
    @Transactional
    public AdminBankAccountDtos.BankAccountResponse toggleAccountStatus(
            UUID id, Boolean isActive, UUID adminId, String ipAddress) {

        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin user not found"));

        AdminBankAccount account = bankAccountRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("Bank account not found"));

        account.setIsActive(Boolean.TRUE.equals(isActive));
        account.setUpdatedAt(Instant.now());
        AdminBankAccount saved = bankAccountRepository.save(account);

        String action = Boolean.TRUE.equals(isActive) ? "ACTIVATED" : "DEACTIVATED";
        AdminBankAccountAuditLog audit = AdminBankAccountAuditLog.builder()
                .bankAccount(saved)
                .actionType(action)
                .admin(admin)
                .details("Bank account status set to: " + (Boolean.TRUE.equals(isActive) ? "ACTIVE" : "INACTIVE"))
                .ipAddress(ipAddress)
                .createdAt(Instant.now())
                .build();
        auditLogRepository.save(audit);

        log.info("Admin {} set bank account {} status to {} from IP {}",
                admin.getUsername(), saved.getAccountNumberMasked(), action, ipAddress);

        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminBankAccountDtos.ActiveBankAccountResponse> getActiveAccounts() {
        return bankAccountRepository.findByIsActiveTrueOrderByCreatedAtDesc().stream()
                .map(a -> new AdminBankAccountDtos.ActiveBankAccountResponse(
                        a.getId(),
                        a.getAccountHolderName(),
                        a.getAccountNumberMasked(),
                        a.getIfscCode(),
                        a.getBankName(),
                        a.getBranch()
                ))
                .collect(Collectors.toList());
    }

    private AdminBankAccountDtos.BankAccountResponse toResponse(AdminBankAccount a) {
        String fullAccount = null;
        try {
            if (a.getAccountNumberEncrypted() != null && !a.getAccountNumberEncrypted().isBlank()) {
                fullAccount = encryptionUtil.decrypt(a.getAccountNumberEncrypted());
            }
        } catch (Exception e) {
            log.warn("Failed to decrypt account number for bank account {}: {}", a.getId(), e.getMessage());
        }
        if (fullAccount == null || fullAccount.isBlank()) {
            fullAccount = a.getAccountNumberMasked();
        }
        return new AdminBankAccountDtos.BankAccountResponse(
                a.getId(),
                a.getAccountHolderName(),
                fullAccount,
                a.getAccountNumberMasked(),
                a.getIfscCode(),
                a.getBankName(),
                a.getBranch(),
                a.getIsActive(),
                a.getCreatedAt(),
                a.getUpdatedAt()
        );
    }
}
