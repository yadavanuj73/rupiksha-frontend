package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.AdminBankAccountDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.AdminBankAccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AdminBankAccountController {

    private final AdminBankAccountService bankAccountService;

    private UUID getPrincipalId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal principal)) {
            throw new IllegalArgumentException("Unauthorized");
        }
        return UUID.fromString(principal.userId());
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * Admin: Add New Bank Account
     */
    @PostMapping("/admin/bank-accounts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> createBankAccount(
            @Valid @RequestBody AdminBankAccountDtos.CreateBankAccountRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {

        UUID adminId = getPrincipalId(auth);
        String ip = getClientIp(servletRequest);
        AdminBankAccountDtos.BankAccountResponse res = bankAccountService.createAccount(request, adminId, ip);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Bank account saved successfully");
        response.put("account", res);
        return ResponseEntity.ok(response);
    }

    /**
     * Admin: List All Bank Accounts (Saved Accounts with masked account numbers)
     */
    @GetMapping("/admin/bank-accounts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAllBankAccounts() {
        List<AdminBankAccountDtos.BankAccountResponse> list = bankAccountService.getAllAccounts();
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("accounts", list);
        return ResponseEntity.ok(response);
    }

    /**
     * Admin: Get single account details (for edit modal)
     */
    @GetMapping("/admin/bank-accounts/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getBankAccountById(@PathVariable UUID id) {
        AdminBankAccountDtos.BankAccountResponse res = bankAccountService.getAccountById(id);
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("account", res);
        return ResponseEntity.ok(response);
    }

    /**
     * Admin: Update Bank Account
     */
    @PutMapping("/admin/bank-accounts/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> updateBankAccount(
            @PathVariable UUID id,
            @Valid @RequestBody AdminBankAccountDtos.UpdateBankAccountRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {

        UUID adminId = getPrincipalId(auth);
        String ip = getClientIp(servletRequest);
        AdminBankAccountDtos.BankAccountResponse res = bankAccountService.updateAccount(id, request, adminId, ip);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Bank account updated successfully");
        response.put("account", res);
        return ResponseEntity.ok(response);
    }

    /**
     * Admin: Toggle Active/Inactive Status
     */
    @PatchMapping("/admin/bank-accounts/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> toggleStatus(
            @PathVariable UUID id,
            @Valid @RequestBody AdminBankAccountDtos.BankAccountStatusUpdateRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {

        UUID adminId = getPrincipalId(auth);
        String ip = getClientIp(servletRequest);
        AdminBankAccountDtos.BankAccountResponse res = bankAccountService.toggleAccountStatus(id, request.isActive(), adminId, ip);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Bank account status updated successfully");
        response.put("account", res);
        return ResponseEntity.ok(response);
    }

    /**
     * Authenticated Users (Retailer, Distributor, Super Distributor): Get Active Bank Accounts
     */
    @GetMapping("/bank-accounts/active")
    public ResponseEntity<Map<String, Object>> getActiveBankAccounts() {
        List<AdminBankAccountDtos.ActiveBankAccountResponse> activeAccounts = bankAccountService.getActiveAccounts();
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("accounts", activeAccounts);
        return ResponseEntity.ok(response);
    }
}
