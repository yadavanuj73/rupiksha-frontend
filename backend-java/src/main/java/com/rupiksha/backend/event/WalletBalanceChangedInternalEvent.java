package com.rupiksha.backend.event;

import java.time.Instant;
import java.util.UUID;

public record WalletBalanceChangedInternalEvent(
        UUID userId,
        String reference,
        String context,
        Instant timestamp
) {
    public WalletBalanceChangedInternalEvent(UUID userId, String reference, String context) {
        this(userId, reference, context, Instant.now());
    }
}
