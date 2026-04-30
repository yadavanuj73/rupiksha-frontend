package com.rupiksha.aeps.dto;

import lombok.Data;

@Data
public class AepsTwoFaRequest {

    private String mobileNumber;
    private String adharNumber;
    private String pidData;
    private String aepsAgentId;
    private String merchantId;
    private String latitude;
    private String longitude;
    private String biometricType;

}