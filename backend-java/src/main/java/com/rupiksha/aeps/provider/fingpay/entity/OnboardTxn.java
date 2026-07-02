package com.rupiksha.aeps.provider.fingpay.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "onboard_txn")
@Getter
@Setter
public class OnboardTxn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "merchant_login_id")
    private String merchantLoginId;

    @Column(name = "txn_id")
    private String txnId;

    @Column(name = "status")
    private String status;   // INIT / SENT / SUCCESS / FAILED

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
