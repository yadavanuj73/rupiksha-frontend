package com.rupiksha.aeps.provider.fingpay.entity;

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

    @Column(name = "merchant_login_id")
    private String merchantLoginId;

    @Column(name = "mobile")
    private String mobile;

    @Column(name = "aadhaar_last4")
    private String aadhaarLast4;

    @Column(name = "primary_key_id")
    private Long primaryKeyId;

    @Column(name = "encode_fp_txn_id")
    private String encodeFPTxnId;

    @Column(name = "resend_count")
    private Integer resendCount;

    @Column(name = "status")
    private String status;

    @Column(name = "txn_id")
    private String txnId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "biometric_status")
    private String biometricStatus;   // SUCCESS / FAILED

    @Column(name = "biometric_at")
    private LocalDateTime biometricAt;

    @Column(name = "biometric_data", columnDefinition = "TEXT")
    private String biometricData;

    @Column(name = "biometric_data_expiry")
    private LocalDateTime biometricDataExpiry;
}
