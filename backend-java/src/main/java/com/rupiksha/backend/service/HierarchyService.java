package com.rupiksha.backend.service;

import com.rupiksha.backend.domain.User;

import java.util.Set;
import java.util.UUID;

public interface HierarchyService {

    /**
     * Checks if operator is an ancestor of target user (or self), or if operator is ADMIN.
     */
    boolean isUserInHierarchy(User operator, User target);

    /**
     * Checks if operator is an ancestor of target user (or self), or if operator is ADMIN.
     */
    boolean isUserInHierarchy(UUID operatorId, UUID targetUserId);

    /**
     * Throws AccessDeniedException if target user is not in operator's hierarchy tree.
     */
    void validateHierarchyAccess(User operator, User target);

    /**
     * Throws AccessDeniedException if target user is not in operator's hierarchy tree.
     */
    void validateHierarchyAccess(UUID operatorId, UUID targetUserId);

    /**
     * Returns all descendant user IDs (plus operator ID) for the given operator.
     * Returns empty set if operator is not found.
     * For ADMIN, returns a set containing all user IDs if needed, or null if unrestricted.
     */
    Set<UUID> getDownlineUserIds(UUID operatorId);

    /**
     * Returns true if user has the ADMIN role.
     */
    boolean isAdmin(User user);

    /**
     * Returns true if user with given ID has the ADMIN role.
     */
    boolean isAdmin(UUID userId);

    /**
     * Returns true if the principal has ADMIN or SUPER_ADMIN role.
     */
    default boolean isAdmin(com.rupiksha.backend.security.JwtPrincipal principal) {
        if (principal == null) return false;
        if (principal.roles() != null && principal.roles().stream()
                .anyMatch(r -> "ADMIN".equalsIgnoreCase(r) || "SUPER_ADMIN".equalsIgnoreCase(r))) {
            return true;
        }
        if (principal.userId() != null) {
            try {
                return isAdmin(UUID.fromString(principal.userId()));
            } catch (Exception ignored) {}
        }
        return false;
    }

    /**
     * Validates that target user is in the hierarchy of the authenticated principal.
     */
    default void validateHierarchyAccess(com.rupiksha.backend.security.JwtPrincipal principal, UUID targetUserId) {
        if (principal == null || principal.userId() == null) {
            throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        }
        if (isAdmin(principal)) {
            return;
        }
        validateHierarchyAccess(UUID.fromString(principal.userId()), targetUserId);
    }
}
