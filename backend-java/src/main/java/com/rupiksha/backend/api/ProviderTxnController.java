package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.ProviderTxnDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.RechargeTransferService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ProviderTxnController {
    private final RechargeTransferService rechargeTransferService;
    private final AppProperties appProperties;

    @PostMapping("/recharge")
    public ProviderTxnDtos.TxnResponse recharge(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody ProviderTxnDtos.RechargeRequest request
    ) {
        if (principal == null || !principal.userId().equals(request.userId())) {
            throw new IllegalArgumentException("Invalid user context");
        }
        if (!appProperties.services().rechargeEnabled()) {
            return new ProviderTxnDtos.TxnResponse(false, null, "Recharge disabled by configuration", java.util.Map.of());
        }
        return rechargeTransferService.recharge(request);
    }

    @PostMapping("/transfer")
    public ProviderTxnDtos.TxnResponse transfer(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody ProviderTxnDtos.TransferRequest request
    ) {
        if (principal == null || !principal.userId().equals(request.userId())) {
            throw new IllegalArgumentException("Invalid user context");
        }
        if (!appProperties.services().payoutEnabled()) {
            return new ProviderTxnDtos.TxnResponse(false, null, "Payout disabled by configuration", java.util.Map.of());
        }
        return rechargeTransferService.transfer(request);
    }
}

