package com.rupiksha.aeps.provider.fingpay.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "aepskyc")
public class AepsKyc {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "uid")
    private Long uid;

    @Column(name = "outlet")
    private String outlet;

    @Column(name = "mpin")
    private String mpin;

    @Column(name = "kyc_done")
    private Boolean kycDone = false;

    @Column(name = "merchant_id")
    private String merchantId;
}