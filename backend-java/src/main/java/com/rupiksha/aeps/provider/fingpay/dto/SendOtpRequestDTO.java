package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class SendOtpRequestDTO {

    private String merchantLoginId;
    private String mobileNumber;
    private String aadharNumber;
    private String panNumber;
    private Double latitude;
    private Double longitude;

}