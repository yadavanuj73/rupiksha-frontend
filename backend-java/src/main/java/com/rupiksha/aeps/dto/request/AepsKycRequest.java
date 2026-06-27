package com.rupiksha.aeps.dto.request;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AepsKycRequest {
    private String aepsAgentId;
    private String merchantId;
    private String aadharNumber;
    private String pidXml;
    private String biometricType;
    private String mobile;
}
