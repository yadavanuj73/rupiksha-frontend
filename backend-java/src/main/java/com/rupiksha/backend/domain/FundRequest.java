package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "fund_requests")
public class FundRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bank_account_id")
    private AdminBankAccount bankAccount;

    // Snapshot of the receiving account at time of submission
    @Column(name = "receiving_account_holder", length = 150)
    private String receivingAccountHolder;

    @Column(name = "receiving_bank_name", length = 100)
    private String receivingBankName;

    @Column(name = "receiving_account_masked", length = 30)
    private String receivingAccountMasked;

    @Column(name = "receiving_ifsc", length = 20)
    private String receivingIfsc;

    @Column(name = "receiving_branch", length = 150)
    private String receivingBranch;

    @Column(name = "user_role", length = 30)
    private String userRole;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED, CANCELLED

    @Column(name = "utr_number", length = 64)
    private String utrNumber;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String method = "NEFT/IMPS"; // NEFT/IMPS, RTGS, UPI, CDM

    @Column(name = "payment_bank", length = 100)
    private String paymentBank;

    @Column(name = "payment_date_time")
    private Instant paymentDateTime;

    @Column(name = "user_note", length = 500)
    private String userNote;

    @Column(length = 255)
    private String remark;

    @Column(name = "admin_remark", length = 255)
    private String adminRemark;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    // Proof file storage metadata
    @Column(name = "proof_storage_path", length = 255)
    private String proofStoragePath;

    @Column(name = "proof_original_filename", length = 255)
    private String proofOriginalFilename;

    @Column(name = "proof_content_type", length = 50)
    private String proofContentType;

    @Column(name = "proof_file_size")
    private Long proofFileSize;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }
}
