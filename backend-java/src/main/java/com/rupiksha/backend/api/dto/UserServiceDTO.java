package com.rupiksha.backend.api.dto;

import com.rupiksha.backend.domain.ServiceType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class UserServiceDTO {
    private UUID id;
    private ServiceType serviceType;
    private Boolean isEnabled;
    private String enabledBy;
    private Instant enabledAt;
    private String disabledBy;
    private Instant disabledAt;
    private String remarks;
}
