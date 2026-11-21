package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.AdminBankAccountDtos;
import java.util.List;
import java.util.UUID;

public interface AdminBankAccountService {
    AdminBankAccountDtos.BankAccountResponse createAccount(
            AdminBankAccountDtos.CreateBankAccountRequest request, UUID adminId, String ipAddress);

    List<AdminBankAccountDtos.BankAccountResponse> getAllAccounts();

    AdminBankAccountDtos.BankAccountResponse getAccountById(UUID id);

    AdminBankAccountDtos.BankAccountResponse updateAccount(
            UUID id, AdminBankAccountDtos.UpdateBankAccountRequest request, UUID adminId, String ipAddress);

    AdminBankAccountDtos.BankAccountResponse toggleAccountStatus(
            UUID id, Boolean isActive, UUID adminId, String ipAddress);

    List<AdminBankAccountDtos.ActiveBankAccountResponse> getActiveAccounts();
}
