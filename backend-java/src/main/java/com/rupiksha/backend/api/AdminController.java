package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.KycDtos;
import com.rupiksha.backend.domain.KycStatus;
import com.rupiksha.backend.domain.Role;
import com.rupiksha.backend.domain.RoleName;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.UserStatus;
import com.rupiksha.backend.repository.RoleRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.security.JwtService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Admin / network management endpoints.
 *
 * Accessible to:
 *  - ADMIN (platform administrator)
 *  - SUPER_DISTRIBUTOR (manages distributors + retailers in their region)
 *  - DISTRIBUTOR (manages their own retailers)
 *
 * Retailers are explicitly denied.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPER_DISTRIBUTOR','DISTRIBUTOR')")
public class AdminController {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @GetMapping("/approvals")
    public Map<String, Object> approvals() {
        List<Map<String, Object>> users = userRepository.findAll().stream()
                .filter(u -> u.getStatus() == UserStatus.PENDING)
                .map(this::toAdminDto)
                .toList();
        return Map.of(
                "success", true,
                "users", users
        );
    }

    /**
     * Full user list for admin UI. Returns lightweight DTOs (no password) with a
     * primary `role` string field the legacy frontend expects.
     */
    @GetMapping("/users")
    public Map<String, Object> listUsers() {
        List<Map<String, Object>> users = userRepository.findAll().stream()
                .map(this::toAdminDto)
                .toList();
        return Map.of(
                "success", true,
                "users", users
        );
    }

    /**
     * Soft-delete stub. No soft-delete table exists yet, so return an empty list.
     * Kept so the admin UI `Trash` panel can render without error.
     */
    @GetMapping("/trash-users")
    public Map<String, Object> trashUsers() {
        return Map.of(
                "success", true,
                "users", List.of()
        );
    }

    /**
     * Delete a user by UUID, username, or mobile.
     * Protected — only ADMIN can delete.
     */
    @DeleteMapping("/users/{identifier}")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> deleteUser(@PathVariable String identifier) {
        User u = resolveUser(identifier);
        if (u == null) {
            return Map.of("success", false, "error", "User not found");
        }
        if (u.getRoles().stream().anyMatch(r -> r.getName() == RoleName.ADMIN)) {
            return Map.of("success", false, "error", "Refusing to delete an ADMIN account.");
        }
        userRepository.delete(u);
        return Map.of(
                "success", true,
                "message", "User deleted",
                "id", u.getId().toString()
        );
    }

    @PatchMapping("/users/{identifier}")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> updateUser(@PathVariable String identifier, @RequestBody Map<String, String> body) {
        User u = resolveUser(identifier);
        if (u == null) return Map.of("success", false, "error", "User not found");
        if (body == null) return Map.of("success", false, "error", "Request body required");
        if (body.containsKey("fullName") && body.get("fullName") != null) u.setFullName(body.get("fullName").trim());
        if (body.containsKey("email") && body.get("email") != null) u.setEmail(body.get("email").trim());
        if (body.containsKey("mobile") && body.get("mobile") != null) u.setMobile(body.get("mobile").trim());
        if (body.containsKey("businessName") && body.get("businessName") != null) u.setBusinessName(body.get("businessName").trim());
        if (body.containsKey("addressLine1") && body.get("addressLine1") != null) u.setAddressLine1(body.get("addressLine1").trim());
        if (body.containsKey("city") && body.get("city") != null) u.setCity(body.get("city").trim());
        if (body.containsKey("stateName") && body.get("stateName") != null) u.setStateName(body.get("stateName").trim());
        if (body.containsKey("pincode") && body.get("pincode") != null) u.setPincode(body.get("pincode").trim());
        User saved = userRepository.save(u);
        return toAdminDto(saved);
    }

    @PostMapping("/approvals/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> approve(@PathVariable String id, @RequestBody Map<String, String> body) {
        User user = userRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String action = body == null ? null : body.get("action");
        if (action == null || action.isBlank()) {
            throw new IllegalArgumentException("Action is required. Use approve/reject");
        }
        String normalized = action.trim().toLowerCase();
        if ("approve".equals(normalized)) {
            user.setStatus(UserStatus.APPROVED);
            // NOTE: kycStatus is NOT changed here — member must submit KYC documents
            // via the KYC form after login, and admin approves KYC separately.
            // Persist party code and upline ownership info supplied by the admin UI
            if (body != null) {
                String pc = body.get("partyCode");
                if (pc != null && !pc.isBlank()) user.setPartyCode(pc.trim().toUpperCase());
                String abn = body.get("addedByName");
                if (abn != null && !abn.isBlank()) user.setAddedByName(abn.trim());
                String abr = body.get("addedByRole");
                if (abr != null && !abr.isBlank()) user.setAddedByRole(abr.trim());
                String abpc = body.get("addedByPartyCode");
                if (abpc != null && !abpc.isBlank()) user.setAddedByPartyCode(abpc.trim());
                String abur = body.get("addedByUserRef");
                if (abur != null && !abur.isBlank()) user.setAddedByUserRef(abur.trim());
            }
        } else if ("reject".equals(normalized)) {
            user.setStatus(UserStatus.REJECTED);
        } else {
            throw new IllegalArgumentException("Unsupported action. Use approve/reject");
        }
        User saved = userRepository.save(user);
        return toAdminDto(saved);
    }

    @PostMapping("/approvals/{id}/issue-credentials")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> approveAndIssueCredentials(@PathVariable String id) {
        User user = userRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setStatus(UserStatus.APPROVED);

        String tempPassword = generateTempPassword();
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        User saved = userRepository.save(user);

        return Map.of(
                "userId", saved.getId().toString(),
                "username", saved.getUsername(),
                "temporaryPassword", tempPassword,
                "status", saved.getStatus().name(),
                "message", "Share temporary password securely. User should change password after first login."
        );
    }

    /**
     * Admin-driven user creation (used by "Add Member" modal in the admin UI).
     * Creates an already-approved user with a known password, so credentials can
     * be shared immediately with the new retailer / distributor / super distributor.
     */
    @PostMapping("/add-user")
    public ResponseEntity<Map<String, Object>> addUser(@RequestBody Map<String, Object> body) {
        Map<String, Object> resp = new HashMap<>();
        try {
            String username = asString(body.get("username"));
            String password = asString(body.get("password"));
            String fullName = asString(body.get("fullName"));
            String phone = asString(body.get("phone"));
            String email = asString(body.get("email"));
            String address = asString(body.get("address"));
            String roleRaw = asString(body.get("role"));
            String shopName = asString(body.get("shopName"));

            if (username == null || username.isBlank()) username = phone;
            if (email == null || email.isBlank()) {
                if (phone != null && !phone.isBlank()) {
                    email = phone + "@rupiksha.local";
                } else {
                    email = username + "@rupiksha.local";
                }
            }
            if (password == null || password.length() < 6) {
                resp.put("success", false);
                resp.put("error", "Password must be at least 6 characters.");
                return ResponseEntity.badRequest().body(resp);
            }
            if (phone == null || phone.isBlank()) {
                resp.put("success", false);
                resp.put("error", "Mobile number is required.");
                return ResponseEntity.badRequest().body(resp);
            }

            RoleName roleName = mapRole(roleRaw);
            Role role = roleRepository.findByName(roleName)
                    .orElseThrow(() -> new IllegalStateException("Role not seeded: " + roleName));

            if (userRepository.findByUsername(username).isPresent()
                    || userRepository.findByMobile(phone).isPresent()
                    || userRepository.findByEmail(email).isPresent()) {
                resp.put("success", false);
                resp.put("error", "User already exists with this mobile / username / email.");
                return ResponseEntity.badRequest().body(resp);
            }

            User u = new User();
            u.setUsername(username);
            u.setMobile(phone);
            u.setEmail(email);
            u.setFullName(fullName == null || fullName.isBlank() ? username : fullName);
            u.setPasswordHash(passwordEncoder.encode(password));
            u.setStatus(UserStatus.ACTIVE);
            u.setKycStatus(KycStatus.NOT_SUBMITTED);
            if (address != null && !address.isBlank()) u.setAddressLine1(address);
            if (shopName != null && !shopName.isBlank() && (u.getAddressLine1() == null || u.getAddressLine1().isBlank())) {
                u.setAddressLine1(shopName);
            }
            Set<Role> roles = new HashSet<>();
            roles.add(role);
            u.setRoles(roles);

            User saved = userRepository.save(u);
            resp.put("success", true);
            resp.put("userId", saved.getId().toString());
            resp.put("username", saved.getUsername());
            resp.put("role", roleName.name());
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.warn("Add user failed", e);
            resp.put("success", false);
            resp.put("error", e.getMessage() == null ? "Unable to create user" : e.getMessage());
            return ResponseEntity.badRequest().body(resp);
        }
    }

    /**
     * Server-side impersonation — only ADMIN can impersonate.
     * Returns a short-lived access token for the target user. Every use is logged.
     */
    @PostMapping("/impersonate/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> impersonate(@PathVariable String userId,
                                           @AuthenticationPrincipal JwtPrincipal principal) {
        User target = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<String> roles = target.getRoles().stream()
                .map(r -> r.getName().name())
                .toList();

        String token = jwtService.createAccessToken(target.getId(), target.getUsername(), roles);

        log.warn("IMPERSONATION: admin {} impersonated user {} ({}), roles={}",
                principal == null ? "?" : principal.userId(),
                target.getId(), target.getUsername(), roles);

        return Map.of(
                "success", true,
                "accessToken", token,
                "userId", target.getId().toString(),
                "username", target.getUsername(),
                "fullName", target.getFullName(),
                "roles", roles,
                "status", target.getStatus() == null ? "APPROVED" : target.getStatus().name(),
                "kycStatus", target.getKycStatus() == null ? "NOT_SUBMITTED" : target.getKycStatus().name(),
                "impersonated", true
        );
    }

    @GetMapping("/kyc/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public List<User> pendingKyc() {
        return userRepository.findByKycStatus(KycStatus.PENDING);
    }

    @PostMapping("/kyc/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public KycDtos.KycStatusResponse decideKyc(
            @PathVariable String id,
            @Valid @RequestBody KycDtos.KycDecisionRequest request
    ) {
        User user = userRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String action = request.action().trim().toLowerCase();
        if ("approve".equals(action)) {
            user.setKycStatus(KycStatus.APPROVED);
            user.setStatus(UserStatus.ACTIVE);
            user.setKycApprovedAt(Instant.now());
            user.setKycRejectionReason(null);
        } else if ("reject".equals(action)) {
            user.setKycStatus(KycStatus.REJECTED);
            user.setKycRejectionReason(request.remarks() == null ? "KYC rejected by admin" : request.remarks());
        } else {
            throw new IllegalArgumentException("Unsupported action. Use approve/reject");
        }
        User saved = userRepository.save(user);
        return new KycDtos.KycStatusResponse(
                saved.getId().toString(),
                saved.getStatus().name(),
                saved.getKycStatus().name(),
                saved.getKycRejectionReason(),
                saved.getKycSubmittedAt(),
                saved.getKycApprovedAt()
        );
    }

    @GetMapping("/reports/users")
    public Map<String, Object> userReport() {
        long total = userRepository.count();
        long approved = userRepository.findAll().stream().filter(u -> u.getStatus() == UserStatus.APPROVED || u.getStatus() == UserStatus.ACTIVE).count();
        long pending = userRepository.findAll().stream().filter(u -> u.getStatus() == UserStatus.PENDING).count();
        long kycPending = userRepository.findByKycStatus(KycStatus.PENDING).size();
        long kycApproved = userRepository.findByKycStatus(KycStatus.APPROVED).size();
        return Map.of(
                "totalUsers", total,
                "approvedUsers", approved,
                "pendingUsers", pending,
                "kycPendingUsers", kycPending,
                "kycApprovedUsers", kycApproved
        );
    }

    private String asString(Object o) {
        return o == null ? null : String.valueOf(o).trim();
    }

    /** Resolve a user by UUID, username, or mobile. */
    private User resolveUser(String identifier) {
        if (identifier == null || identifier.isBlank()) return null;
        try {
            UUID id = UUID.fromString(identifier);
            return userRepository.findById(id).orElse(null);
        } catch (IllegalArgumentException ignored) { /* not a uuid */ }
        return userRepository.findByUsername(identifier)
                .or(() -> userRepository.findByMobile(identifier))
                .or(() -> userRepository.findByEmail(identifier))
                .orElse(null);
    }

    /** Light DTO for the admin members list. Excludes password hash and base64 KYC blobs. */
    private Map<String, Object> toAdminDto(User u) {
        String primaryRole = u.getRoles().stream()
                .map(r -> r.getName().name())
                .findFirst()
                .orElse("RETAILER");
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", u.getId().toString());
        dto.put("_id", u.getId().toString());
        dto.put("username", u.getUsername());
        dto.put("mobile", u.getMobile());
        dto.put("email", u.getEmail());
        dto.put("fullName", u.getFullName());
        dto.put("name", u.getFullName());
        dto.put("role", primaryRole);
        dto.put("roles", u.getRoles().stream().map(r -> r.getName().name()).toList());
        dto.put("status", u.getStatus() == null ? null : u.getStatus().name());
        dto.put("kycStatus", u.getKycStatus() == null ? null : u.getKycStatus().name());
        dto.put("addressLine1", u.getAddressLine1());
        dto.put("city", u.getCity());
        dto.put("stateName", u.getStateName());
        dto.put("pincode", u.getPincode());
        dto.put("aadhaarNumber", u.getAadhaarNumber());
        dto.put("panNumber", u.getPanNumber());
        dto.put("businessName", u.getBusinessName());
        dto.put("partyCode", u.getPartyCode());
        dto.put("state", u.getStateName());
        dto.put("addedByUserRef", u.getAddedByUserRef());
        dto.put("addedByName", u.getAddedByName());
        dto.put("addedByRole", u.getAddedByRole());
        dto.put("addedByPartyCode", u.getAddedByPartyCode());
        dto.put("createdAt", u.getCreatedAt());
        dto.put("updatedAt", u.getUpdatedAt());
        dto.put("wallet", Map.of("balance", 0));
        return dto;
    }

    private RoleName mapRole(String raw) {
        if (raw == null) return RoleName.RETAILER;
        String normalized = raw.replace('-', '_').replace(' ', '_').toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ADMIN" -> RoleName.ADMIN;
            case "DISTRIBUTOR" -> RoleName.DISTRIBUTOR;
            case "SUPER_DISTRIBUTOR", "SUPERDISTRIBUTOR" -> RoleName.SUPER_DISTRIBUTOR;
            default -> RoleName.RETAILER;
        };
    }

    private String generateTempPassword() {
        final String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        sb.append("1A@");
        return sb.toString();
    }
}
