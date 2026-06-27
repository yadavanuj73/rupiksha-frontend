package com.rupiksha.aeps.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BaseRequest {
    @NotBlank(message = "Correlation ID is required")
    private String correlationId;
    private String clientIp;
    private Long timestamp;
}
