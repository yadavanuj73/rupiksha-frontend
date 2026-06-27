package com.rupiksha.aeps.dto.request;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AepsDailyAuthRequest {
    private String mobileNumber;
    private String adharNumber;
    private String pidXml;
    private String merchantId;
    private String latitude;
    private String longitude;
    private String biometricType;
}
