package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.UserMappingDtos.*;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.UserMappingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Slf4j
@RestController
@RequestMapping({"/admin/user-mapping", "/api/admin/user-mapping", "/api/v1/admin/user-mapping"})
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserMappingController {

    private final UserMappingService userMappingService;

    @GetMapping("/search-retailers")
    public ResponseEntity<Page<UserMappingSearchDto>> searchRetailers(
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
        return ResponseEntity.ok(userMappingService.searchRetailers(query, pageable));
    }

    @GetMapping("/search-distributors")
    public ResponseEntity<Page<UserMappingSearchDto>> searchDistributors(
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
        return ResponseEntity.ok(userMappingService.searchDistributors(query, pageable));
    }

    @GetMapping("/search-super-distributors")
    public ResponseEntity<Page<UserMappingSearchDto>> searchSuperDistributors(
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 50));
        return ResponseEntity.ok(userMappingService.searchSuperDistributors(query, pageable));
    }

    @PostMapping("/map")
    public ResponseEntity<UserMappingResponseDto> mapUser(
            @Valid @RequestBody UserMappingRequest request,
            @AuthenticationPrincipal JwtPrincipal principal) {
        log.info("Admin {} initiating user mapping: Retailer ID={} to Role={}",
                principal != null ? principal.username() : "admin",
                request.getRetailerId(), request.getTargetRole());
        UserMappingResponseDto response = userMappingService.mapUser(request, principal);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/details/{retailerId}")
    public ResponseEntity<UserMappingDetailDto> getMappingDetails(@PathVariable UUID retailerId) {
        return ResponseEntity.ok(userMappingService.getMappingDetails(retailerId));
    }

    @GetMapping("/list")
    public ResponseEntity<Page<UserMappingTableItemDto>> getCurrentMappingsList(
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "ALL") String role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection) {
        Sort sort = Sort.by(Sort.Direction.fromString(sortDirection), sortBy);
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), sort);
        return ResponseEntity.ok(userMappingService.getCurrentMappingsList(search, role, pageable));
    }

    @GetMapping("/history")
    public ResponseEntity<Page<UserMappingHistoryDto>> getMappingHistory(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID retailerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        return ResponseEntity.ok(userMappingService.getMappingHistory(search, retailerId, pageable));
    }
}
