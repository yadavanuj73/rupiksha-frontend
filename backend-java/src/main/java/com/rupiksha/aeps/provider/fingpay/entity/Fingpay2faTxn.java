package com.rupiksha.aeps.provider.fingpay.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "fingpay_2fa_txn")
public class Fingpay2faTxn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "merchant_tran_id", unique = true)
    private String merchantTranId;

    @Column(name = "fingpay_transaction_id")
    private String fingpayTransactionId;

    @Column(name = "tef_pk_id")
    private Long tefPkId;

    private String stan;

    @Column(name = "fp_rrn")
    private String fpRrn;

    @Column(name = "response_code")
    private String responseCode;

    @Column(name = "response_message")
    private String responseMessage;

    @Column(name = "mobile_number")
    private String mobileNumber;

    @Column(name = "transaction_timestamp")
    private LocalDateTime transactionTimestamp;

    @Column(name = "authenticated_at")
    private LocalDateTime authenticatedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "service_type")
    private String serviceType;

    private String provider;
}
