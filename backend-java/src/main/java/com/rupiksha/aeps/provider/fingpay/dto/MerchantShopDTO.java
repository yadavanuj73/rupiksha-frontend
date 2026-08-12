package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class MerchantShopDTO {

    private String shopAddress;
    private String shopCity;
    private String shopDistrict;
    private Object shopState;
    private String shopPincode;
    private Object shopLatitude;
    private Object shopLongitude;
}