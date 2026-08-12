package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class KycDTO {

    private String userPan;
    private String aadhaarNumber;
    private String gstinNumber;
    private String companyOrShopPan;
    private Object shopAndPanImage;
}