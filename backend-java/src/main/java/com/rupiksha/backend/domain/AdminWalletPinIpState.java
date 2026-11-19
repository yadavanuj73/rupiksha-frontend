package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "admin_wallet_pin_ip_state")
public class AdminWalletPinIpState {

    @Id
    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts = 0;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public boolean isCurrentlyLocked() {
        return lockedUntil != null && Instant.now().isBefore(lockedUntil);
    }
}
