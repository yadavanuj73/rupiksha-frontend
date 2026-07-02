package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class OnboardRequestDTO {

    private String username;
    private String password;
    private String ipAddress;
    private Double latitude;
    private Double longitude;
    private Integer superMerchantId;
    private MerchantDTO merchant;
}