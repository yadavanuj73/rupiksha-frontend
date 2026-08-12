package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class MerchantDTO {

    private String merchantLoginId;
    private String merchantLoginPin;
    private String firstName;
    private String lastName;
    private String middleName;
    private String merchantPhoneNumber;
    private MerchantAddressDTO merchantAddress;

    private String companyLegalName;
    private Integer companyType;
    private String emailId;

    private String certificateOfIncorporationImage;

    private KycDTO kyc;

    private SettlementDTO settlementV1;

    private String tradeBusinessProof;
    private Object termsConditionCheck;
    private String cancelledChequeImages;
    private Object physicalVerification;
    private String videoKycWithLatLongData;

    private MerchantShopDTO merchantKycAddressData;
}