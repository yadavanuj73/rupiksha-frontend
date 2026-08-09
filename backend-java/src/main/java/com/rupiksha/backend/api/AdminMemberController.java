package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.*;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.MemberManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping({"/admin/members", "/api/admin/members", "/api/v1/admin/members"})
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_DISTRIBUTOR', 'DISTRIBUTOR')")
@CrossOrigin(origins = {"http://localhost:5173", "https://your-frontend.vercel.app"})
public class AdminMemberController {

    private final MemberManagementService memberManagementService;

    @GetMapping
    public ResponseEntity<Page<MemberDetailResponse>> getAllMembers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection) {
        
        Sort sort = Sort.by(Sort.Direction.fromString(sortDirection), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<MemberDetailResponse> members = memberManagementService.getAllMembers(pageable, search);
        return ResponseEntity.ok(members);
    }

    @GetMapping("/{userId}")
    public ResponseEntity<MemberDetailResponse> getMemberDetail(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "false") boolean includePassword) {
        
        MemberDetailResponse member = memberManagementService.getMemberDetail(userId, includePassword);
        return ResponseEntity.ok(member);
    }

    @GetMapping("/{userId}/services")
    public ResponseEntity<List<UserServiceDTO>> getUserServices(@PathVariable UUID userId) {
        List<UserServiceDTO> services = memberManagementService.getUserServices(userId);
        return ResponseEntity.ok(services);
    }

    @PostMapping("/{userId}/services/toggle")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserServiceDTO> toggleUserService(
            @PathVariable UUID userId,
            @Valid @RequestBody ServiceToggleRequest request,
            @AuthenticationPrincipal JwtPrincipal admin) {
        
        UserServiceDTO result = memberManagementService.toggleUserService(userId, request, admin);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{userId}/services/init")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserServiceDTO>> initializeUserServices(@PathVariable UUID userId) {
        List<UserServiceDTO> services = memberManagementService.initializeDefaultServices(userId);
        return ResponseEntity.ok(services);
    }
}
