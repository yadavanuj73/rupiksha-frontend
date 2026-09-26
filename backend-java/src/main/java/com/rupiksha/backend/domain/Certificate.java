package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "certificates")
public class Certificate {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "certificate_number", nullable = false, unique = true, length = 60)
    private String certificateNumber;

    @Column(name = "party_code", nullable = false, length = 30)
    private String partyCode;

    @Column(name = "certificate_type", nullable = false, length = 40)
    private String certificateType;

    @Column(name = "role", nullable = false, length = 40)
    private String role;

    @Column(name = "issued_on", nullable = false)
    private LocalDate issuedOn;

    @Column(name = "valid_till", nullable = false)
    private LocalDate validTill;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "VALID";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
