package com.example.Rupiksha.Fingpay.dto;

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
    private Object companyType;
    private String emailId;

    private Object certificateOfIncorporationImage;

    private KycDTO kyc;

    private SettlementDTO settlementV1;

    private Object tradeBusinessProof;
    private Object termsConditionCheck;
    private Object cancelledChequeImages;
    private Object physicalVerification;
    private Object videoKycWithLatLongData;

    private MerchantShopDTO merchantKycAddressData;
}