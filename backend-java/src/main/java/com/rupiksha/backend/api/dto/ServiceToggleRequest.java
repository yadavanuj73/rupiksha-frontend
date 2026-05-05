package com.rupiksha.backend.api.dto;

import com.rupiksha.backend.domain.ServiceType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ServiceToggleRequest {
    @NotNull
    private ServiceType serviceType;
    
    @NotNull
    private Boolean enable;
    
    private String remarks;
}
