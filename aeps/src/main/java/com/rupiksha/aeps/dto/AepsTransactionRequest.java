package com.rupiksha.aeps.dto;

import lombok.Data;

@Data
public class AepsTransactionRequest {

    private String txnid;

    private String mobileNumber;
    private String adharNumber;
    private String pidData;

    private String aepsMethod;
    private String amount;

    private String customerMobileNumber;

    private String aepsBankName;
    private String aepsBankCode;

    private String latitude;
    private String longitude;

    private String biometricType;

    private String name;
    private String pinCode;
    private String address;
    private String shopName;
    private String city;
    private String state;

}