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

    private String merchantLoginId;

    private String txnId;

    private String status;   // INIT / SENT / SUCCESS / FAILED

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
