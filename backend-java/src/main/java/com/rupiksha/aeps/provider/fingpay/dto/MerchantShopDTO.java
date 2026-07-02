package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class MerchantShopDTO {

    private String shopAddress;
    private String shopCity;
    private String shopDistrict;
    private Integer shopState;
    private String shopPincode;
    private Double shopLatitude;
    private Double shopLongitude;
}