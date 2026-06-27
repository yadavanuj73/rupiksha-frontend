package com.rupiksha.aeps.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DailyAuthRequest {
    @NotBlank(message = "PID XML is required")
    private String pidXml;

    @NotBlank(message = "Latitude is required")
    private String latitude;

    @NotBlank(message = "Longitude is required")
    private String longitude;

    private String biometricType = "FMR";
}
