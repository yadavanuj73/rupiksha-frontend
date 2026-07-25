package com.example.Rupiksha.Fingpay.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "ekyc_txn")
@Getter
@Setter
public class EkycTxn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String merchantLoginId;

    private String mobile;

    private String aadhaarLast4;

    private Long primaryKeyId;

    private String encodeFPTxnId;

    private Integer resendCount;

    private String status;

    private String txnId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String biometricStatus;   // SUCCESS / FAILED
    private LocalDateTime biometricAt;
}
