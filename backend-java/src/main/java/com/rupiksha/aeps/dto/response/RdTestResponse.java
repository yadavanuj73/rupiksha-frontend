package com.rupiksha.aeps.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RdTestResponse {
    private boolean success;
    private String rdVersion;
    private String pidVersion;
    private Integer captureQuality;
    private String timestamp;
    private String message;
}
