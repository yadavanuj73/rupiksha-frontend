package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.UserMappingDtos.*;
import com.rupiksha.backend.security.JwtPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface UserMappingService {

    Page<UserMappingSearchDto> searchRetailers(String query, Pageable pageable);

    Page<UserMappingSearchDto> searchDistributors(String query, Pageable pageable);

    Page<UserMappingSearchDto> searchSuperDistributors(String query, Pageable pageable);

    UserMappingResponseDto mapUser(UserMappingRequest request, JwtPrincipal adminPrincipal);

    UserMappingDetailDto getMappingDetails(UUID retailerId);

    Page<UserMappingTableItemDto> getCurrentMappingsList(String search, String roleFilter, Pageable pageable);

    Page<UserMappingHistoryDto> getMappingHistory(String search, UUID retailerId, Pageable pageable);
}
