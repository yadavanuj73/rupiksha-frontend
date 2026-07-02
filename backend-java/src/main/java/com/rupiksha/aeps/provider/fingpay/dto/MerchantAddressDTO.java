package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class MerchantAddressDTO {

    private String merchantAddress1;
    private String merchantAddress2;
    private Integer merchantState;
    private String merchantCityName;
    private String merchantDistrictName;
    private String merchantPinCode;
}