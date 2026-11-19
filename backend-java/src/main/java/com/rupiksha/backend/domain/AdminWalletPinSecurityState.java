package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "admin_wallet_pin_security_state")
public class AdminWalletPinSecurityState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_user_id", nullable = false, unique = true)
    private UUID adminUserId;

    @Column(name = "admin_username", nullable = false, length = 100)
    private String adminUsername;

    @Column(name = "consecutive_failed_attempts", nullable = false)
    private int consecutiveFailedAttempts = 0;

    @Column(name = "total_failed_attempts", nullable = false)
    private int totalFailedAttempts = 0;

    @Column(name = "last_failed_at")
    private Instant lastFailedAt;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "lockout_count", nullable = false)
    private int lockoutCount = 0;

    @Column(name = "last_successful_at")
    private Instant lastSuccessfulAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public boolean isCurrentlyLocked() {
        return lockedUntil != null && Instant.now().isBefore(lockedUntil);
    }
}
