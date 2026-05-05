package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.WalletService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/wallet")
@RequiredArgsConstructor
public class WalletController {
    private final WalletService walletService;

    /**
     * Balance is accessible to:
     *  - the wallet owner themselves (principal.userId == {userId})
     *  - Admin / Super Distributor / Distributor (manage retailers in their network)
     */
    @GetMapping("/{userId}/balance")
    public WalletDtos.WalletBalanceResponse balance(@PathVariable String userId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal principal)) {
            throw new AccessDeniedException("Authentication required");
        }
        boolean isSelf = principal.userId() != null
                && principal.userId().toString().equalsIgnoreCase(userId);
        boolean isPrivileged = auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_ADMIN".equals(a.getAuthority())
                        || "ROLE_SUPER_DISTRIBUTOR".equals(a.getAuthority())
                        || "ROLE_DISTRIBUTOR".equals(a.getAuthority()));
        if (!isSelf && !isPrivileged) {
            throw new AccessDeniedException("Not allowed to view this wallet balance");
        }
        return walletService.getBalance(userId);
    }

    @PostMapping("/credit")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_DISTRIBUTOR','DISTRIBUTOR')")
    public WalletDtos.WalletBalanceResponse credit(@Valid @RequestBody WalletDtos.WalletEntryRequest request) {
        return walletService.credit(request);
    }

    @PostMapping("/debit")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_DISTRIBUTOR','DISTRIBUTOR')")
    public WalletDtos.WalletBalanceResponse debit(@Valid @RequestBody WalletDtos.WalletEntryRequest request) {
        return walletService.debit(request);
    }
}

