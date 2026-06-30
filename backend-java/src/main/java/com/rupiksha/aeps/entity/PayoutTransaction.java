package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "payout_transactions")
public class PayoutTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String orderId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private String beneficiaryName;

    @Column(nullable = false)
    private String accountNumber;

    @Column(nullable = false)
    private String ifsc;

    private String bankName;

    @Column(nullable = false)
    private String transferMode; // IMPS, NEFT, RTGS

    private String remarks;

    private String mobileNumber;

    private String accountType; // Savings, Current

    @Column(nullable = false)
    private String status; // PENDING, SUCCESS, FAILED

    private String statusCode;

    @Column(length = 1000)
    private String responseMessage;

    @Column(length = 2000)
    private String responseData;

    private String utr; // Unique Transaction Reference

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = "PENDING";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

// Made with Bob
