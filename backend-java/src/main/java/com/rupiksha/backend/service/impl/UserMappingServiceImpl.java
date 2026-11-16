package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.UserMappingDtos.*;
import com.rupiksha.backend.domain.RoleName;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.UserMapping;
import com.rupiksha.backend.domain.UserStatus;
import com.rupiksha.backend.repository.UserMappingRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.UserMappingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserMappingServiceImpl implements UserMappingService {

    private final UserRepository userRepository;
    private final UserMappingRepository userMappingRepository;

    @Override
    @Transactional(readOnly = true)
    public Page<UserMappingSearchDto> searchRetailers(String query, Pageable pageable) {
        String cleanQuery = sanitizeQuery(query);
        Page<User> users = userRepository.findByRoleAndSearch(RoleName.RETAILER, cleanQuery, pageable);
        return users.map(u -> toSearchDto(u, "RETAILER"));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserMappingSearchDto> searchDistributors(String query, Pageable pageable) {
        String cleanQuery = sanitizeQuery(query);
        Page<User> users = userRepository.findEligibleParentsByRoleAndSearch(RoleName.DISTRIBUTOR, cleanQuery, pageable);
        return users.map(u -> toSearchDto(u, "DISTRIBUTOR"));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserMappingSearchDto> searchSuperDistributors(String query, Pageable pageable) {
        String cleanQuery = sanitizeQuery(query);
        Page<User> users = userRepository.findEligibleParentsByRoleAndSearch(RoleName.SUPER_DISTRIBUTOR, cleanQuery, pageable);
        return users.map(u -> toSearchDto(u, "SUPER_DISTRIBUTOR"));
    }

    @Override
    @Transactional
    public UserMappingResponseDto mapUser(UserMappingRequest request, JwtPrincipal adminPrincipal) {
        if (request == null || request.getRetailerId() == null) {
            throw new IllegalArgumentException("Retailer ID is required.");
        }

        String targetRole = request.getTargetRole() != null ? request.getTargetRole().trim().toUpperCase(Locale.ROOT) : "";
        if (!Set.of("ADMIN", "DISTRIBUTOR", "SUPER_DISTRIBUTOR").contains(targetRole)) {
            throw new IllegalArgumentException("Invalid target role: " + targetRole + ". Must be ADMIN, DISTRIBUTOR, or SUPER_DISTRIBUTOR.");
        }

        // 1. Fetch Retailer
        User retailer = userRepository.findById(request.getRetailerId())
                .orElseThrow(() -> new IllegalArgumentException("Retailer not found with ID: " + request.getRetailerId()));

        boolean isRetailer = retailer.getRoles().stream().anyMatch(r -> r.getName() == RoleName.RETAILER);
        if (!isRetailer) {
            throw new IllegalArgumentException("Selected user is not a Retailer.");
        }

        // 2. Identify Authenticated Admin
        User adminUser = resolveAdminUser(adminPrincipal);

        // 3. Resolve Previous Parent Data
        User prevParent = retailer.getParentUser();
        UUID prevParentId = prevParent != null ? prevParent.getId() : null;
        String prevParentRole = retailer.getAddedByRole();
        String prevParentName = prevParent != null ? prevParent.getFullName() : retailer.getAddedByName();
        String prevParentPartyCode = prevParent != null ? prevParent.getPartyCode() : retailer.getAddedByPartyCode();

        if (prevParent != null && (prevParentRole == null || prevParentRole.isBlank())) {
            prevParentRole = prevParent.getRoles().stream()
                    .map(r -> r.getName().name())
                    .findFirst()
                    .orElse("DISTRIBUTOR");
        }

        User newParent;
        String actionType = prevParent == null && (prevParentName == null || prevParentName.isBlank())
                ? "INITIAL_MAPPING" : "REMAPPING";

        // 4. Handle Target Role Mappings
        if ("ADMIN".equals(targetRole)) {
            newParent = adminUser;

            // Check if already mapped to Admin
            boolean alreadyAdmin = (prevParent == null && ("ADMIN".equalsIgnoreCase(prevParentRole) || "Direct".equalsIgnoreCase(prevParentRole)))
                    || (prevParent != null && prevParent.getRoles().stream().anyMatch(r -> r.getName() == RoleName.ADMIN));
            if (alreadyAdmin) {
                throw new IllegalStateException("This Retailer is already mapped under Admin.");
            }

            retailer.setParentUser(adminUser);
            retailer.setAddedByUserRef(adminUser != null ? adminUser.getId().toString() : "admin");
            retailer.setAddedByName(adminUser != null ? adminUser.getFullName() : "System Admin");
            retailer.setAddedByPartyCode(adminUser != null && adminUser.getPartyCode() != null ? adminUser.getPartyCode() : "RPADM");
            retailer.setAddedByRole("ADMIN");

        } else if ("DISTRIBUTOR".equals(targetRole)) {
            if (request.getTargetParentId() == null) {
                throw new IllegalArgumentException("Distributor ID is required when mapping under a Distributor.");
            }
            if (retailer.getId().equals(request.getTargetParentId())) {
                throw new IllegalArgumentException("Cannot map a user to themselves.");
            }

            User distributor = userRepository.findById(request.getTargetParentId())
                    .orElseThrow(() -> new IllegalArgumentException("Distributor not found with ID: " + request.getTargetParentId()));

            boolean hasDistRole = distributor.getRoles().stream().anyMatch(r -> r.getName() == RoleName.DISTRIBUTOR);
            if (!hasDistRole) {
                throw new IllegalArgumentException("Target user does not have the DISTRIBUTOR role.");
            }

            if (distributor.getStatus() != UserStatus.ACTIVE && distributor.getStatus() != UserStatus.APPROVED) {
                throw new IllegalStateException("Cannot map under an inactive or rejected Distributor.");
            }

            if (isAncestorOf(distributor, retailer.getId())) {
                throw new IllegalStateException("Circular hierarchy relationship detected. Cannot map user under its own descendant.");
            }

            if (prevParent != null && prevParent.getId().equals(distributor.getId())) {
                throw new IllegalStateException("This Retailer is already mapped under the selected user.");
            }

            newParent = distributor;
            retailer.setParentUser(distributor);
            retailer.setAddedByUserRef(distributor.getId().toString());
            retailer.setAddedByName(distributor.getFullName());
            retailer.setAddedByPartyCode(distributor.getPartyCode());
            retailer.setAddedByRole("DISTRIBUTOR");

        } else { // SUPER_DISTRIBUTOR
            if (request.getTargetParentId() == null) {
                throw new IllegalArgumentException("Super Distributor ID is required when mapping under a Super Distributor.");
            }
            if (retailer.getId().equals(request.getTargetParentId())) {
                throw new IllegalArgumentException("Cannot map a user to themselves.");
            }

            User superDistributor = userRepository.findById(request.getTargetParentId())
                    .orElseThrow(() -> new IllegalArgumentException("Super Distributor not found with ID: " + request.getTargetParentId()));

            boolean hasSdRole = superDistributor.getRoles().stream().anyMatch(r -> r.getName() == RoleName.SUPER_DISTRIBUTOR);
            if (!hasSdRole) {
                throw new IllegalArgumentException("Target user does not have the SUPER_DISTRIBUTOR role.");
            }

            if (superDistributor.getStatus() != UserStatus.ACTIVE && superDistributor.getStatus() != UserStatus.APPROVED) {
                throw new IllegalStateException("Cannot map under an inactive or rejected Super Distributor.");
            }

            if (isAncestorOf(superDistributor, retailer.getId())) {
                throw new IllegalStateException("Circular hierarchy relationship detected. Cannot map user under its own descendant.");
            }

            if (prevParent != null && prevParent.getId().equals(superDistributor.getId())) {
                throw new IllegalStateException("This Retailer is already mapped under the selected user.");
            }

            newParent = superDistributor;
            retailer.setParentUser(superDistributor);
            retailer.setAddedByUserRef(superDistributor.getId().toString());
            retailer.setAddedByName(superDistributor.getFullName());
            retailer.setAddedByPartyCode(superDistributor.getPartyCode());
            retailer.setAddedByRole("SUPER_DISTRIBUTOR");
        }

        // 5. Save updated retailer hierarchy atomically
        userRepository.save(retailer);

        // 6. Mark previous active mappings as SUPERSEDED
        List<UserMapping> activeMappings = userMappingRepository.findAllByUserIdAndStatus(retailer.getId(), "ACTIVE");
        for (UserMapping m : activeMappings) {
            m.setStatus("SUPERSEDED");
            userMappingRepository.save(m);
        }

        // 7. Record immutable audit record
        UserMapping mapping = UserMapping.builder()
                .user(retailer)
                .userRole("RETAILER")
                .previousParent(prevParent)
                .previousParentRole(prevParentRole)
                .previousParentName(prevParentName)
                .previousParentPartyCode(prevParentPartyCode)
                .newParent(newParent)
                .newParentRole(targetRole)
                .newParentName(newParent != null ? newParent.getFullName() : "System Admin")
                .newParentPartyCode(newParent != null ? newParent.getPartyCode() : "RPADM")
                .actionType(actionType)
                .mappedByAdmin(adminUser)
                .mappedByAdminUsername(adminUser != null ? adminUser.getUsername() : "admin")
                .reason(request.getReason() != null ? request.getReason().trim() : null)
                .status("ACTIVE")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        UserMapping savedMapping = userMappingRepository.save(mapping);
        log.info("User mapping successful: Retailer {} mapped under {} ({}) by admin {}",
                retailer.getUsername(), targetRole, newParent != null ? newParent.getUsername() : "ADMIN",
                adminUser != null ? adminUser.getUsername() : "admin");

        return UserMappingResponseDto.builder()
                .mappingId(savedMapping.getId())
                .retailerId(retailer.getId())
                .retailerName(retailer.getFullName())
                .retailerPartyCode(retailer.getPartyCode())
                .retailerMobile(retailer.getMobile())
                .parentRole(targetRole)
                .parentId(newParent != null ? newParent.getId() : null)
                .parentName(newParent != null ? newParent.getFullName() : "System Admin")
                .parentPartyCode(newParent != null ? newParent.getPartyCode() : "RPADM")
                .message("Retailer mapped successfully under " + targetRole)
                .mappedAt(savedMapping.getCreatedAt())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public UserMappingDetailDto getMappingDetails(UUID retailerId) {
        User retailer = userRepository.findById(retailerId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with ID: " + retailerId));

        String ownerRole = resolveOwnerRole(retailer);
        String ownerName = resolveOwnerName(retailer);
        String ownerPartyCode = resolveOwnerPartyCode(retailer);
        String ownerMobile = null;
        UUID ownerId = null;

        if (retailer.getParentUser() != null) {
            ownerId = retailer.getParentUser().getId();
            ownerMobile = retailer.getParentUser().getMobile();
        }

        Optional<UserMapping> active = userMappingRepository.findTopByUserIdAndStatusOrderByCreatedAtDesc(retailerId, "ACTIVE");
        Instant lastMappedAt = active.map(UserMapping::getCreatedAt).orElse(retailer.getUpdatedAt());
        String lastMappedBy = active.map(UserMapping::getMappedByAdminUsername).orElse("System");
        int count = (int) userMappingRepository.findHistoryWithFilters(retailerId, null, Pageable.unpaged()).getTotalElements();

        return UserMappingDetailDto.builder()
                .retailerId(retailer.getId())
                .retailerName(retailer.getFullName())
                .partyCode(retailer.getPartyCode())
                .mobile(retailer.getMobile())
                .address(formatAddress(retailer))
                .status(retailer.getStatus() != null ? retailer.getStatus().name() : "ACTIVE")
                .currentOwnerRole(ownerRole)
                .currentOwnerId(ownerId)
                .currentOwnerName(ownerName)
                .currentOwnerPartyCode(ownerPartyCode)
                .currentOwnerMobile(ownerMobile)
                .lastMappedAt(lastMappedAt)
                .lastMappedByAdmin(lastMappedBy)
                .mappingHistoryCount(count)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserMappingTableItemDto> getCurrentMappingsList(String search, String roleFilter, Pageable pageable) {
        String cleanSearch = sanitizeQuery(search);
        Page<User> retailers = userRepository.findByRoleAndSearch(RoleName.RETAILER, cleanSearch, pageable);

        List<UserMappingTableItemDto> items = new ArrayList<>();
        for (User r : retailers.getContent()) {
            String mappedUnder;
            String parentName;
            String parentPartyCode;
            Instant mappingDate = r.getUpdatedAt() != null ? r.getUpdatedAt() : r.getCreatedAt();

            if (r.getParentUser() != null) {
                User p = r.getParentUser();
                boolean isDist = p.getRoles().stream().anyMatch(role -> role.getName() == RoleName.DISTRIBUTOR);
                boolean isSuperDist = p.getRoles().stream().anyMatch(role -> role.getName() == RoleName.SUPER_DISTRIBUTOR);
                boolean isAdmin = p.getRoles().stream().anyMatch(role -> role.getName() == RoleName.ADMIN);

                if (isDist) {
                    mappedUnder = "DISTRIBUTOR";
                } else if (isSuperDist) {
                    mappedUnder = "SUPER_DISTRIBUTOR";
                } else if (isAdmin) {
                    mappedUnder = "ADMIN";
                } else {
                    mappedUnder = r.getAddedByRole() != null ? r.getAddedByRole().toUpperCase(Locale.ROOT) : "ADMIN";
                }
                parentName = p.getFullName();
                parentPartyCode = p.getPartyCode();
            } else if (r.getAddedByRole() != null && !r.getAddedByRole().isBlank()) {
                mappedUnder = r.getAddedByRole().toUpperCase(Locale.ROOT);
                parentName = r.getAddedByName() != null ? r.getAddedByName() : "Admin";
                parentPartyCode = r.getAddedByPartyCode() != null ? r.getAddedByPartyCode() : "—";
            } else {
                mappedUnder = "ADMIN";
                parentName = "Admin / Direct";
                parentPartyCode = "—";
            }

            // Check if user has an explicit active mapping
            Optional<UserMapping> activeMapping = userMappingRepository.findTopByUserIdAndStatusOrderByCreatedAtDesc(r.getId(), "ACTIVE");
            if (activeMapping.isPresent()) {
                UserMapping m = activeMapping.get();
                mappedUnder = m.getNewParentRole();
                parentName = m.getNewParentName();
                parentPartyCode = m.getNewParentPartyCode();
                mappingDate = m.getCreatedAt();
            }

            // Apply role filter if requested (e.g. ADMIN, DISTRIBUTOR, SUPER_DISTRIBUTOR)
            if (roleFilter != null && !roleFilter.isBlank() && !"ALL".equalsIgnoreCase(roleFilter)) {
                if (!mappedUnder.equalsIgnoreCase(roleFilter.trim())) {
                    continue;
                }
            }

            items.add(UserMappingTableItemDto.builder()
                    .id(r.getId())
                    .retailerId(r.getId())
                    .retailerName(r.getFullName())
                    .partyCode(r.getPartyCode())
                    .mobile(r.getMobile())
                    .address(formatAddress(r))
                    .mappedUnder(mappedUnder)
                    .parentName(parentName)
                    .parentPartyCode(parentPartyCode)
                    .mappingDate(mappingDate)
                    .status(r.getStatus() != null ? r.getStatus().name() : "ACTIVE")
                    .active(r.getStatus() == UserStatus.ACTIVE || r.getStatus() == UserStatus.APPROVED)
                    .build());
        }

        return new PageImpl<>(items, pageable, retailers.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserMappingHistoryDto> getMappingHistory(String search, UUID retailerId, Pageable pageable) {
        String cleanSearch = sanitizeQuery(search);
        Page<UserMapping> history = userMappingRepository.findHistoryWithFilters(retailerId, cleanSearch, pageable);
        return history.map(um -> UserMappingHistoryDto.builder()
                .mappingId(um.getId())
                .retailerId(um.getUser() != null ? um.getUser().getId() : null)
                .retailerName(um.getUser() != null ? um.getUser().getFullName() : "—")
                .retailerPartyCode(um.getUser() != null ? um.getUser().getPartyCode() : "—")
                .retailerMobile(um.getUser() != null ? um.getUser().getMobile() : "—")
                .previousParentId(um.getPreviousParent() != null ? um.getPreviousParent().getId() : null)
                .previousParentRole(um.getPreviousParentRole())
                .previousParentName(um.getPreviousParentName())
                .previousParentPartyCode(um.getPreviousParentPartyCode())
                .newParentId(um.getNewParent() != null ? um.getNewParent().getId() : null)
                .newParentRole(um.getNewParentRole())
                .newParentName(um.getNewParentName())
                .newParentPartyCode(um.getNewParentPartyCode())
                .actionType(um.getActionType())
                .mappedByAdminUsername(um.getMappedByAdminUsername())
                .reason(um.getReason())
                .status(um.getStatus())
                .createdAt(um.getCreatedAt())
                .build());
    }

    // ── Helper methods ─────────────────────────────────────────────────────────

    private boolean isAncestorOf(User user, UUID targetId) {
        if (user == null || targetId == null) return false;
        Set<UUID> visited = new HashSet<>();
        User current = user;
        while (current != null) {
            if (targetId.equals(current.getId())) {
                return true;
            }
            if (!visited.add(current.getId())) {
                break;
            }
            current = current.getParentUser();
        }
        return false;
    }

    private User resolveAdminUser(JwtPrincipal principal) {
        if (principal != null && principal.username() != null) {
            Optional<User> found = userRepository.findByUsername(principal.username());
            if (found.isPresent()) return found.get();
        }
        return userRepository.findByUsername("admin").orElse(null);
    }

    private String sanitizeQuery(String query) {
        if (query == null) return "";
        String trimmed = query.trim();
        if (trimmed.startsWith("+91")) {
            trimmed = trimmed.substring(3).trim();
        } else if (trimmed.startsWith("91") && trimmed.length() == 12) {
            trimmed = trimmed.substring(2).trim();
        }
        return trimmed;
    }

    private String formatAddress(User u) {
        List<String> parts = new ArrayList<>();
        if (u.getShopAddress() != null && !u.getShopAddress().isBlank()) {
            parts.add(u.getShopAddress().trim());
        } else if (u.getAddressLine1() != null && !u.getAddressLine1().isBlank()) {
            parts.add(u.getAddressLine1().trim());
        }
        if (u.getCity() != null && !u.getCity().isBlank()) {
            parts.add(u.getCity().trim());
        }
        if (u.getStateName() != null && !u.getStateName().isBlank()) {
            parts.add(u.getStateName().trim());
        }
        if (u.getPincode() != null && !u.getPincode().isBlank()) {
            parts.add(u.getPincode().trim());
        }
        return parts.isEmpty() ? "Address not available" : String.join(", ", parts);
    }

    private String resolveOwnerName(User u) {
        if (u.getParentUser() != null) {
            return u.getParentUser().getFullName();
        }
        if (u.getAddedByName() != null && !u.getAddedByName().isBlank()) {
            return u.getAddedByName();
        }
        return "Admin / Self / Direct";
    }

    private String resolveOwnerPartyCode(User u) {
        if (u.getParentUser() != null) {
            return u.getParentUser().getPartyCode() != null ? u.getParentUser().getPartyCode() : "—";
        }
        if (u.getAddedByPartyCode() != null && !u.getAddedByPartyCode().isBlank()) {
            return u.getAddedByPartyCode();
        }
        return "—";
    }

    private String resolveOwnerRole(User u) {
        if (u.getParentUser() != null) {
            return u.getParentUser().getRoles().stream()
                    .map(r -> r.getName().name())
                    .findFirst()
                    .orElse("DISTRIBUTOR");
        }
        if (u.getAddedByRole() != null && !u.getAddedByRole().isBlank()) {
            return u.getAddedByRole().toUpperCase(Locale.ROOT);
        }
        return "ADMIN";
    }

    private UserMappingSearchDto toSearchDto(User u, String role) {
        return UserMappingSearchDto.builder()
                .id(u.getId())
                .fullName(u.getFullName())
                .mobile(u.getMobile())
                .partyCode(u.getPartyCode())
                .address(formatAddress(u))
                .currentOwnerName(resolveOwnerName(u))
                .currentOwnerPartyCode(resolveOwnerPartyCode(u))
                .currentOwnerRole(resolveOwnerRole(u))
                .status(u.getStatus() != null ? u.getStatus().name() : "ACTIVE")
                .role(role)
                .build();
    }
}
