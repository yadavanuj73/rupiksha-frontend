package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class WalletDtos {
    public record WalletBalanceResponse(String userId, BigDecimal balance) {}
    public record WalletEntryRequest(
            @NotBlank String userId,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotBlank String narration
    ) {}
}

