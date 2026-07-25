package com.example.Rupiksha.Fingpay.dto;

import lombok.Data;

@Data
public class KycDTO {

    private String userPan;
    private String aadhaarNumber;
    private String gstinNumber;
    private String companyOrShopPan;
    private String shopAndPanImage;
}