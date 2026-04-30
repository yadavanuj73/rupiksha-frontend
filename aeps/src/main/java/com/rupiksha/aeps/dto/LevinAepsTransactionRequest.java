package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LevinAepsTransactionRequest {

    @JsonProperty("api_token")
    private String apiToken;

    @JsonProperty("mobile_number")
    private String mobileNumber;

    @JsonProperty("aeps_method")
    private String aepsMethod;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("adhar_number")
    private String adharNumber;

    @JsonProperty("client_id")
    private String clientId;

    private String amount;

    @JsonProperty("customer_mobile_number")
    private String customerMobileNumber;

    @JsonProperty("aeps_bank_name")
    private String aepsBankName;

    // Case Sensitive - Levin requirement
    @JsonProperty("RdPidData")
    private String rdPidData;

    private String ftype;

    @JsonProperty("aeps_bank_code")
    private String aepsBankCode;

    private String latitude;
    private String longitude;

    // Case sensitive field
    @JsonProperty("biometricType")
    private String biometricType;

    private String name;

    @JsonProperty("pin_code")
    private String pinCode;

    private String address;

    @JsonProperty("shop_name")
    private String shopName;

    private String city;
    private String state;

    // Optional fields
    private String ad1;
    private String ad2;
    private String ad3;
    private String ad4;
}