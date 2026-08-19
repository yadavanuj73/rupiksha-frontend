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

    /** True once the mandatory Bank eKYC (BeKYC) biometric step is completed. */
    @Column(name = "bank_ekyc_done")
    private Boolean bankEkycDone = false;

    /**
     * primaryKeyId returned by Fingpay SendOTP when BANK_EKYC_REQUIRED is raised.
     * Stored so that the subsequent biometric submission can reference it.
     */
    @Column(name = "bank_ekyc_primary_key_id")
    private Long bankEkycPrimaryKeyId;

    /**
     * encodeFPTxnId returned by Fingpay SendOTP when BANK_EKYC_REQUIRED is raised.
     * Stored so that the subsequent biometric submission can reference it.
     */
    @Column(name = "bank_ekyc_encode_fp_txn_id")
    private String bankEkycEncodeFPTxnId;
}