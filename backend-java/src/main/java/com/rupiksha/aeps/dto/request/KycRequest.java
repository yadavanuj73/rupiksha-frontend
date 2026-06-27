package com.rupiksha.aeps.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class KycRequest {
    @NotBlank(message = "PID XML is required")
    private String pidXml;

    private String biometricType = "FMR";
}
