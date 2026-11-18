package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.service.HierarchyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class HierarchyServiceImpl implements HierarchyService {

    private final UserRepository userRepository;

    @Override
    public boolean isAdmin(User user) {
        if (user == null || user.getRoles() == null) {
            return false;
        }
        return user.getRoles().stream()
                .anyMatch(r -> r.getName() != null && "ADMIN".equalsIgnoreCase(r.getName().name()));
    }

    @Override
    public boolean isAdmin(UUID userId) {
        if (userId == null) return false;
        return userRepository.findById(userId).map(this::isAdmin).orElse(false);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isUserInHierarchy(User operator, User target) {
        if (operator == null || target == null) {
            return false;
        }

        // Platform Admin has global visibility across all users
        if (isAdmin(operator)) {
            return true;
        }

        // Self-access is always permitted within hierarchy
        if (operator.getId().equals(target.getId())) {
            return true;
        }

        String operatorIdStr = operator.getId().toString();
        String currentParentRef = target.getAddedByUserRef();
        User currentParentUser = target.getParentUser();

        // Traverse upwards from target to see if operator is an ancestor
        int maxDepth = 10; // Guard against potential circular references in data
        int depth = 0;
        Set<UUID> visited = new HashSet<>();
        visited.add(target.getId());

        while (depth++ < maxDepth) {
            UUID nextParentId = null;

            if (currentParentUser != null) {
                if (currentParentUser.getId().equals(operator.getId())) {
                    return true;
                }
                nextParentId = currentParentUser.getId();
            } else if (currentParentRef != null && !currentParentRef.isBlank()) {
                if (currentParentRef.equalsIgnoreCase(operatorIdStr)) {
                    return true;
                }
                try {
                    nextParentId = UUID.fromString(currentParentRef.trim());
                } catch (Exception ignored) {
                    break;
                }
            } else {
                break;
            }

            if (nextParentId == null || visited.contains(nextParentId)) {
                break;
            }
            visited.add(nextParentId);

            User nextParent = userRepository.findById(nextParentId).orElse(null);
            if (nextParent == null) {
                break;
            }

            currentParentUser = nextParent.getParentUser();
            currentParentRef = nextParent.getAddedByUserRef();
        }

        return false;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isUserInHierarchy(UUID operatorId, UUID targetUserId) {
        if (operatorId == null || targetUserId == null) return false;
        if (operatorId.equals(targetUserId)) return true;

        User operator = userRepository.findById(operatorId).orElse(null);
        User target = userRepository.findById(targetUserId).orElse(null);
        if (operator == null || target == null) return false;

        return isUserInHierarchy(operator, target);
    }

    @Override
    @Transactional(readOnly = true)
    public void validateHierarchyAccess(User operator, User target) {
        if (!isUserInHierarchy(operator, target)) {
            String opName = operator != null ? operator.getUsername() : "unknown";
            String tgtName = target != null ? target.getUsername() : "unknown";
            log.warn("SECURITY ALERT: Hierarchy access violation attempt by operator {} on target {}", opName, tgtName);
            throw new AccessDeniedException("Access Denied: Target user is not in your authorized hierarchy.");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public void validateHierarchyAccess(UUID operatorId, UUID targetUserId) {
        if (!isUserInHierarchy(operatorId, targetUserId)) {
            log.warn("SECURITY ALERT: Hierarchy access violation attempt by operator {} on target {}", operatorId, targetUserId);
            throw new AccessDeniedException("Access Denied: Target user is not in your authorized hierarchy.");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> getDownlineUserIds(UUID operatorId) {
        if (operatorId == null) return Collections.emptySet();

        User operator = userRepository.findById(operatorId).orElse(null);
        if (operator == null) return Collections.emptySet();

        if (isAdmin(operator)) {
            // Null indicates all users (unrestricted for admin)
            return null;
        }

        Set<UUID> downline = new HashSet<>();
        downline.add(operatorId);

        List<User> allUsers = userRepository.findAll();
        for (User u : allUsers) {
            if (isUserInHierarchy(operator, u)) {
                downline.add(u.getId());
            }
        }

        return downline;
    }
}
