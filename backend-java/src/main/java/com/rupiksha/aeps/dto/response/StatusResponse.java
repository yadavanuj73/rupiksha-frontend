package com.rupiksha.aeps.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StatusResponse {
    private boolean onboarded;
    private boolean kycDone;
    private boolean aeps2faDone;
    private String agentId;
    private String merchantId;
}
