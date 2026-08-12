package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.KycDtos;
import com.rupiksha.backend.domain.KycStatus;
import com.rupiksha.backend.domain.Role;
import com.rupiksha.backend.domain.RoleName;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.UserStatus;
import com.rupiksha.backend.domain.Wallet;
import com.rupiksha.backend.repository.RoleRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.WalletRepository;
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

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
@RequestMapping({"/api/v1/admin", "/api/admin", "/admin"})
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPER_DISTRIBUTOR','DISTRIBUTOR')")
public class AdminController {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final WalletRepository walletRepository;
    private final com.rupiksha.backend.repository.UserServiceRepository userServiceRepository;

    @jakarta.persistence.PersistenceContext
    private final jakarta.persistence.EntityManager entityManager;

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
     * Wallet balances are batch-loaded in ONE query to avoid N+1.
     */
    @GetMapping({"/users", "/members"})
    public Map<String, Object> listUsers() {
        List<User> users = userRepository.findAll();

        // Batch-load wallets for ALL users in one query
        List<UUID> userIds = users.stream().map(User::getId).collect(Collectors.toList());
        Map<UUID, BigDecimal> walletMap = walletRepository.findByUserIdIn(userIds)
                .stream()
                .filter(w -> w != null && w.getUser() != null && w.getUser().getId() != null)
                .collect(Collectors.toMap(
                        w -> w.getUser().getId(),
                        w -> w.getBalance() != null ? w.getBalance() : BigDecimal.ZERO,
                        (a, b) -> a  // keep first on duplicate (edge case)
                ));

        List<Map<String, Object>> dtos = users.stream()
                .map(u -> toAdminDto(u, walletMap))
                .toList();
        return Map.of(
                "success", true,
                "users", dtos
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
    @DeleteMapping({"/users/{identifier}", "/members/{identifier}"})
    @org.springframework.transaction.annotation.Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> deleteUser(@PathVariable String identifier) {
        User u = resolveUser(identifier);
        if (u == null) {
            return Map.of("success", false, "error", "User not found");
        }
        if (u.getRoles().stream().anyMatch(r -> r.getName() == RoleName.ADMIN)) {
            return Map.of("success", false, "error", "Refusing to delete an ADMIN account.");
        }

        UUID userId = u.getId();
        String userIdStr = userId.toString();
        String username = u.getUsername();

        try {
            // 1. Unlink any child users referencing this user as parent
            try {
                entityManager.createNativeQuery("UPDATE users SET parent_user_id = NULL WHERE parent_user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Unlink parent_user_id warn", e); }

            // 2. Clear user_roles join table
            try {
                entityManager.createNativeQuery("DELETE FROM user_roles WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete user_roles warn", e); }

            // 3. Clear user_services
            try {
                entityManager.createNativeQuery("DELETE FROM user_services WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete user_services warn", e); }

            // 4. Clear transactions
            try {
                entityManager.createNativeQuery("DELETE FROM transactions WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete transactions warn", e); }

            // 5. Clear recharges
            try {
                entityManager.createNativeQuery("DELETE FROM recharges WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete recharges warn", e); }

            // 6. Clear tickets
            try {
                entityManager.createNativeQuery("DELETE FROM tickets WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete tickets warn", e); }

            // 7. Clear fund_requests
            try {
                entityManager.createNativeQuery("DELETE FROM fund_requests WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete fund_requests warn", e); }

            // 8. Clear payout_transactions
            try {
                entityManager.createNativeQuery("DELETE FROM payout_transactions WHERE user_id = :uidStr OR user_id = :uname")
                        .setParameter("uidStr", userIdStr)
                        .setParameter("uname", username)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete payout_transactions warn", e); }

            // 9. Clear aeps_transaction_engine
            try {
                entityManager.createNativeQuery("DELETE FROM aeps_transaction_engine WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete aeps_transaction_engine warn", e); }

            // 10. Clear aeps_kyc_history
            try {
                entityManager.createNativeQuery("DELETE FROM aeps_kyc_history WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete aeps_kyc_history warn", e); }

            // 11. Clear fingpay_2fa_txn
            try {
                entityManager.createNativeQuery("DELETE FROM fingpay_2fa_txn WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete fingpay_2fa_txn warn", e); }

            // 12. Clear refresh_tokens
            try {
                entityManager.createNativeQuery("DELETE FROM refresh_tokens WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete refresh_tokens warn", e); }

            // 13. Null out operator_id in wallet_entries and delete wallet_entries for user's wallet
            try {
                entityManager.createNativeQuery("UPDATE wallet_entries SET operator_id = NULL WHERE operator_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
                entityManager.createNativeQuery("DELETE FROM wallet_entries WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id = :uid)")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete wallet_entries warn", e); }

            // 14. Clear wallets
            try {
                entityManager.createNativeQuery("DELETE FROM wallets WHERE user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete wallets warn", e); }

            // 15. Clear audit_logs
            try {
                entityManager.createNativeQuery("DELETE FROM audit_logs WHERE target_user_id = :uid OR actor_user_id = :uid")
                        .setParameter("uid", userId)
                        .executeUpdate();
            } catch (Exception e) { log.warn("Delete audit_logs warn", e); }

            // 16. Delete user entity
            entityManager.createNativeQuery("DELETE FROM users WHERE id = :uid")
                    .setParameter("uid", userId)
                    .executeUpdate();

            return Map.of(
                    "success", true,
                    "message", "User deleted",
                    "id", userIdStr
            );
        } catch (Exception e) {
            log.error("Failed to delete user {}", identifier, e);
            return Map.of("success", false, "error", "Failed to delete user: " + e.getMessage());
        }
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

    @GetMapping("/users/{identifier}/services")
    public List<Map<String, Object>> getUserServicesAdmin(@PathVariable String identifier) {
        User u = resolveUser(identifier);
        if (u == null) return List.of();
        List<com.rupiksha.backend.domain.UserService> services = userServiceRepository.findByUserId(u.getId());
        if (services.isEmpty()) {
            for (com.rupiksha.backend.domain.ServiceType type : com.rupiksha.backend.domain.ServiceType.values()) {
                boolean defaultEnable = switch (type) {
                    case AEPS, BBPS, PAYOUT, DMT -> false;
                    default -> true;
                };
                com.rupiksha.backend.domain.UserService s = new com.rupiksha.backend.domain.UserService();
                s.setUser(u);
                s.setServiceType(type);
                s.setIsEnabled(defaultEnable);
                s.setEnabledBy("system");
                s.setEnabledAt(Instant.now());
                services.add(userServiceRepository.save(s));
            }
        }
        return services.stream().map(s -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", s.getId().toString());
            map.put("serviceType", s.getServiceType().name());
            map.put("isEnabled", s.getIsEnabled());
            map.put("enabledBy", s.getEnabledBy());
            map.put("enabledAt", s.getEnabledAt());
            map.put("remarks", s.getRemarks());
            return map;
        }).toList();
    }

    @PostMapping("/users/{identifier}/services/toggle")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> toggleUserServiceAdmin(
            @PathVariable String identifier,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal JwtPrincipal admin) {
        User u = resolveUser(identifier);
        if (u == null) return Map.of("success", false, "error", "User not found");
        String serviceTypeStr = (String) body.get("serviceType");
        Boolean enable = (Boolean) body.get("enable");
        if (serviceTypeStr == null || enable == null) {
            return Map.of("success", false, "error", "serviceType and enable boolean required");
        }
        com.rupiksha.backend.domain.ServiceType type = com.rupiksha.backend.domain.ServiceType.valueOf(serviceTypeStr.trim().toUpperCase());
        var opt = userServiceRepository.findByUserIdAndServiceType(u.getId(), type);
        com.rupiksha.backend.domain.UserService service = opt.orElseGet(() -> {
            com.rupiksha.backend.domain.UserService ns = new com.rupiksha.backend.domain.UserService();
            ns.setUser(u);
            ns.setServiceType(type);
            return ns;
        });
        service.setIsEnabled(enable);
        service.setEnabledBy(admin != null ? admin.username() : "admin");
        service.setEnabledAt(Instant.now());
        if (body.containsKey("remarks")) {
            service.setRemarks((String) body.get("remarks"));
        }
        com.rupiksha.backend.domain.UserService saved = userServiceRepository.save(service);
        return Map.of(
                "success", true,
                "id", saved.getId().toString(),
                "serviceType", saved.getServiceType().name(),
                "isEnabled", saved.getIsEnabled(),
                "enabledBy", saved.getEnabledBy()
        );
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
                "mobile", target.getMobile(),
                "fullName", target.getFullName(),
                "roles", roles,
                "status", target.getStatus() == null ? "APPROVED" : target.getStatus().name(),
                "kycStatus", target.getKycStatus() == null ? "NOT_SUBMITTED" : target.getKycStatus().name(),
                "impersonated", true
        );
    }

    @GetMapping("/kyc/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> pendingKyc() {
        return userRepository.findByKycStatus(KycStatus.PENDING)
                .stream().map(this::toAdminDto).toList();
    }

    @GetMapping("/kyc/all")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> allKyc() {
        return userRepository.findAll().stream()
                .filter(u -> u.getKycStatus() != null && u.getKycStatus() != KycStatus.NOT_SUBMITTED)
                .map(this::toAdminDto).toList();
    }

    @GetMapping("/kyc/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> kycDetail(@PathVariable String id) {
        User u = userRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return toAdminDto(u);
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
            enableKycServices(user);
        } else if ("reject".equals(action) || "resubmit".equals(action)) {
            user.setKycStatus(KycStatus.REJECTED);
            user.setKycRejectionReason(request.remarks() == null || request.remarks().isBlank()
                    ? ("resubmit".equals(action) ? "Resubmission requested by admin" : "KYC rejected by admin")
                    : request.remarks());
        } else {
            throw new IllegalArgumentException("Unsupported action. Use approve/reject/resubmit");
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

    private void enableKycServices(User user) {
        List<com.rupiksha.backend.domain.ServiceType> kycServices = List.of(
                com.rupiksha.backend.domain.ServiceType.AEPS,
                com.rupiksha.backend.domain.ServiceType.DMT,
                com.rupiksha.backend.domain.ServiceType.PAYOUT
        );
        for (com.rupiksha.backend.domain.ServiceType type : kycServices) {
            var opt = userServiceRepository.findByUserIdAndServiceType(user.getId(), type);
            com.rupiksha.backend.domain.UserService s = opt.orElseGet(() -> {
                com.rupiksha.backend.domain.UserService news = new com.rupiksha.backend.domain.UserService();
                news.setUser(user);
                news.setServiceType(type);
                return news;
            });
            s.setIsEnabled(true);
            s.setEnabledBy("admin");
            s.setEnabledAt(Instant.now());
            userServiceRepository.save(s);
        }
    }

    @PostMapping("/users/{identifier}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> updateUserStatus(@PathVariable String identifier, @RequestBody Map<String, String> body) {
        User u = resolveUser(identifier);
        if (u == null) return Map.of("success", false, "error", "User not found");
        String statusStr = body.get("status");
        if (statusStr == null || statusStr.isBlank()) return Map.of("success", false, "error", "Status required");
        try {
            UserStatus newStatus = UserStatus.valueOf(statusStr.trim().toUpperCase());
            u.setStatus(newStatus);
            User saved = userRepository.save(u);
            return Map.of("success", true, "message", "User status updated to " + newStatus.name(), "user", toAdminDto(saved));
        } catch (Exception e) {
            return Map.of("success", false, "error", "Invalid status value: " + statusStr);
        }
    }

    @PostMapping("/users/{identifier}/reset-password")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> adminResetPassword(@PathVariable String identifier, @RequestBody Map<String, String> body) {
        User u = resolveUser(identifier);
        if (u == null) return Map.of("success", false, "error", "User not found");
        String newPassword = body.get("newPassword");
        if (newPassword == null || newPassword.length() < 6) {
            return Map.of("success", false, "error", "New password must be at least 6 characters");
        }
        u.setPasswordHash(passwordEncoder.encode(newPassword.trim()));
        u.setPasswordLastChanged(Instant.now());
        userRepository.save(u);
        return Map.of("success", true, "message", "Password reset successfully");
    }

    @PostMapping("/users/{identifier}/reset-pin")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> adminResetPin(@PathVariable String identifier, @RequestBody Map<String, String> body) {
        User u = resolveUser(identifier);
        if (u == null) return Map.of("success", false, "error", "User not found");
        String newPin = body.get("newPin");
        if (newPin == null || newPin.isBlank()) {
            return Map.of("success", false, "error", "New PIN is required");
        }
        u.setPinHash(passwordEncoder.encode(newPin.trim()));
        u.setPinLastChanged(Instant.now());
        userRepository.save(u);
        return Map.of("success", true, "message", "Login PIN reset successfully");
    }

    @PostMapping("/users/{identifier}/change-parent")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> changeParent(@PathVariable String identifier, @RequestBody Map<String, String> body) {
        User u = resolveUser(identifier);
        if (u == null) return Map.of("success", false, "error", "User not found");
        String parentIdentifier = body.get("parentIdentifier");
        if (parentIdentifier == null || parentIdentifier.isBlank()) {
            u.setParentUser(null);
            u.setAddedByUserRef(null);
            u.setAddedByName(null);
            u.setAddedByPartyCode(null);
            u.setAddedByRole(null);
        } else {
            User parent = resolveUser(parentIdentifier);
            if (parent == null) return Map.of("success", false, "error", "Parent user not found");
            u.setParentUser(parent);
            u.setAddedByUserRef(parent.getId().toString());
            u.setAddedByName(parent.getFullName());
            u.setAddedByPartyCode(parent.getPartyCode());
            String pRole = parent.getRoles().stream().map(r -> r.getName().name()).findFirst().orElse("DISTRIBUTOR");
            u.setAddedByRole(pRole);
        }
        User saved = userRepository.save(u);
        return Map.of("success", true, "message", "Parent hierarchy updated", "user", toAdminDto(saved));
    }

    @GetMapping("/parents")
    public Map<String, Object> listCandidateParents(@RequestParam(required = false) String role) {
        List<Map<String, Object>> parents = userRepository.findAll().stream()
                .filter(u -> u.getStatus() == UserStatus.ACTIVE || u.getStatus() == UserStatus.APPROVED)
                .map(u -> Map.<String, Object>of(
                        "id", u.getId().toString(),
                        "fullName", u.getFullName() == null ? "" : u.getFullName(),
                        "username", u.getUsername(),
                        "mobile", u.getMobile(),
                        "partyCode", u.getPartyCode() == null ? "" : u.getPartyCode(),
                        "role", u.getRoles().stream().map(r -> r.getName().name()).findFirst().orElse("RETAILER")
                ))
                .toList();
        return Map.of("success", true, "parents", parents);
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

    @GetMapping("/reports/top-merchants")
    public Map<String, Object> topMerchantsReport(
            @RequestParam(defaultValue = "month") String timeframe,
            @RequestParam(defaultValue = "All States") String state) {
        List<User> users = userRepository.findAll();
        if (state != null && !"All States".equalsIgnoreCase(state.trim())) {
            String targetState = state.trim().toLowerCase();
            users = users.stream()
                    .filter(u -> (u.getStateName() != null && u.getStateName().toLowerCase().contains(targetState)) ||
                                 (u.getShopState() != null && u.getShopState().toLowerCase().contains(targetState)))
                    .toList();
        }

        List<UUID> userIds = users.stream().map(User::getId).toList();
        Map<UUID, BigDecimal> walletMap = walletRepository.findByUserIdIn(userIds)
                .stream()
                .collect(Collectors.toMap(
                        w -> w.getUser().getId(),
                        Wallet::getBalance,
                        (a, b) -> a
                ));

        List<Map<String, Object>> merchants = users.stream().map(u -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", u.getId().toString());
            m.put("name", u.getFullName() != null ? u.getFullName() : u.getUsername());
            m.put("business_name", u.getBusinessName() != null ? u.getBusinessName() : "N/A");
            m.put("mobile", u.getMobile());
            m.put("state", u.getStateName() != null ? u.getStateName() : (u.getShopState() != null ? u.getShopState() : "N/A"));
            BigDecimal bal = walletMap.getOrDefault(u.getId(), BigDecimal.ZERO);
            m.put("wallet_balance", bal);
            m.put("total_volume", bal);
            m.put("transaction_count", 0);
            return m;
        }).toList();

        return Map.of("success", true, "merchants", merchants);
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

    /** Light DTO for the admin members list. Excludes password hash and base64 KYC blobs.
     *  Accepts a pre-built wallet balance map for batch-load callers; falls back to
     *  a direct single-user lookup when the map is empty (detail / approval views). */
    private Map<String, Object> toAdminDto(User u, Map<UUID, BigDecimal> walletMap) {
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
        dto.put("firstName", u.getFirstName());
        dto.put("lastName", u.getLastName());
        dto.put("dob", u.getDob());
        dto.put("shopAddress", u.getShopAddress());
        dto.put("permanentAddress", u.getPermanentAddress());
        dto.put("photoUrl", u.getPhotoUrl());
        dto.put("aadhaarPhotoUrl", u.getAadhaarPhotoUrl());
        dto.put("panPhotoUrl", u.getPanPhotoUrl());
        dto.put("shopPhotoUrl", u.getShopPhotoUrl());
        dto.put("bankPassbookUrl", u.getBankPassbookUrl());
        dto.put("kycSubmittedAt", u.getKycSubmittedAt());
        dto.put("kycApprovedAt", u.getKycApprovedAt());
        dto.put("kycRejectionReason", u.getKycRejectionReason());
        dto.put("businessName", u.getBusinessName());
        dto.put("partyCode", u.getPartyCode());
        dto.put("state", u.getStateName());
        dto.put("registrationStatus", u.getRegistrationStatus() == null ? "APPROVED" : u.getRegistrationStatus().name());
        dto.put("pinConfigured", u.getPinHash() != null && !u.getPinHash().isBlank());
        dto.put("otpVerified", u.getOtpVerified() != null && u.getOtpVerified());
        dto.put("passwordLastChanged", u.getPasswordLastChanged());
        dto.put("pinLastChanged", u.getPinLastChanged());

        // Personal & Business
        dto.put("fatherName", u.getFatherName());
        dto.put("gender", u.getGender());
        dto.put("businessType", u.getBusinessType());
        dto.put("gstNumber", u.getGstNumber());

        // Shop & Permanent Address
        dto.put("shopLandmark", u.getShopLandmark());
        dto.put("shopState", u.getShopState());
        dto.put("shopDistrict", u.getShopDistrict());
        dto.put("shopCity", u.getShopCity());
        dto.put("shopPincode", u.getShopPincode());
        dto.put("permState", u.getPermState());
        dto.put("permDistrict", u.getPermDistrict());
        dto.put("permCity", u.getPermCity());
        dto.put("permPincode", u.getPermPincode());

        // Bank Details
        dto.put("bankAccountHolder", u.getBankAccountHolder());
        dto.put("bankName", u.getBankName());
        dto.put("bankAccountNumber", u.getBankAccountNumber());
        dto.put("bankIfsc", u.getBankIfsc());
        dto.put("bankBranch", u.getBankBranch());

        // Documents & Live Verification
        dto.put("aadhaarBackPhotoUrl", u.getAadhaarBackPhotoUrl());
        dto.put("drivingLicenceUrl", u.getDrivingLicenceUrl());
        dto.put("voterIdUrl", u.getVoterIdUrl());
        dto.put("passportUrl", u.getPassportUrl());
        dto.put("liveSelfieUrl", u.getLiveSelfieUrl());
        dto.put("gpsLat", u.getGpsLat());
        dto.put("gpsLong", u.getGpsLong());
        dto.put("gpsTimestamp", u.getGpsTimestamp());
        dto.put("deviceInfo", u.getDeviceInfo());

        // Hierarchy Parent
        if (u.getParentUser() != null) {
            dto.put("parentUserId", u.getParentUser().getId().toString());
            dto.put("parentName", u.getParentUser().getFullName());
            dto.put("parentPartyCode", u.getParentUser().getPartyCode());
        } else {
            dto.put("parentUserId", u.getAddedByUserRef());
            dto.put("parentName", u.getAddedByName());
            dto.put("parentPartyCode", u.getAddedByPartyCode());
        }

        dto.put("createdAt", u.getCreatedAt());
        dto.put("updatedAt", u.getUpdatedAt());


        // ─── Authoritative wallet balance ──────────────────────────────────────
        // Use the pre-built map (batch-load) when available; otherwise do a
        // single direct lookup (for detail / approval endpoints with 1 user).
        BigDecimal balance;
        if (!walletMap.isEmpty()) {
            balance = walletMap.getOrDefault(u.getId(), BigDecimal.ZERO);
        } else {
            balance = walletRepository.findByUserId(u.getId())
                    .map(Wallet::getBalance)
                    .orElse(BigDecimal.ZERO);
        }
        dto.put("walletBalance", balance);          // canonical field read by Members table
        dto.put("wallet", Map.of("balance", balance)); // legacy compat
        return dto;
    }

    /** Convenience overload for single-user endpoints (approvals, kyc detail, etc.) */
    private Map<String, Object> toAdminDto(User u) {
        return toAdminDto(u, Collections.emptyMap());
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
