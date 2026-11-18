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
    private final com.rupiksha.backend.repository.UserMappingRepository userMappingRepository;

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
    public User getEffectiveParent(User user) {
        if (user == null) return null;

        // 1. Check user_mappings for active mapping
        if (userMappingRepository != null && user.getId() != null) {
            try {
                Optional<com.rupiksha.backend.domain.UserMapping> activeMapping =
                        userMappingRepository.findTopByUserIdAndStatusOrderByCreatedAtDesc(user.getId(), "ACTIVE");
                if (activeMapping.isPresent() && activeMapping.get().getNewParent() != null) {
                    return activeMapping.get().getNewParent();
                }
            } catch (Exception e) {
                log.warn("Failed to check active user_mapping for user {}: {}", user.getId(), e.getMessage());
            }
        }

        // 2. Check parentUser direct relationship
        if (user.getParentUser() != null) {
            return user.getParentUser();
        }

        // 3. Check addedByUserRef (can be UUID, partyCode, mobile, or username)
        String ref = user.getAddedByUserRef();
        if (ref != null && !ref.isBlank()) {
            User p = findUserByIdentifier(ref);
            if (p != null) return p;
        }

        // 4. Check addedByPartyCode
        String pc = user.getAddedByPartyCode();
        if (pc != null && !pc.isBlank()) {
            return userRepository.findByPartyCode(pc.trim()).orElse(null);
        }

        return null;
    }

    private User findUserByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) return null;
        String clean = identifier.trim();
        try {
            UUID id = UUID.fromString(clean);
            Optional<User> byId = userRepository.findById(id);
            if (byId.isPresent()) return byId.get();
        } catch (IllegalArgumentException ignored) {
        }
        return userRepository.findByPartyCode(clean)
                .or(() -> userRepository.findByMobile(clean))
                .or(() -> userRepository.findByUsername(clean))
                .orElse(null);
    }

    private boolean isImmediateChild(User operator, User target) {
        if (target.getParentUser() != null && target.getParentUser().getId().equals(operator.getId())) {
            return true;
        }
        String ref = target.getAddedByUserRef();
        if (ref != null && !ref.isBlank()) {
            String clean = ref.trim();
            if (clean.equalsIgnoreCase(operator.getId().toString())) return true;
            if (operator.getUsername() != null && clean.equalsIgnoreCase(operator.getUsername())) return true;
            if (operator.getMobile() != null && clean.equalsIgnoreCase(operator.getMobile())) return true;
            if (operator.getPartyCode() != null && clean.equalsIgnoreCase(operator.getPartyCode())) return true;
        }
        String pc = target.getAddedByPartyCode();
        if (pc != null && !pc.isBlank() && operator.getPartyCode() != null && pc.trim().equalsIgnoreCase(operator.getPartyCode())) {
            return true;
        }
        if (userMappingRepository != null && target.getId() != null) {
            try {
                Optional<com.rupiksha.backend.domain.UserMapping> activeMap =
                        userMappingRepository.findTopByUserIdAndStatusOrderByCreatedAtDesc(target.getId(), "ACTIVE");
                if (activeMap.isPresent() && activeMap.get().getNewParent() != null
                        && activeMap.get().getNewParent().getId().equals(operator.getId())) {
                    return true;
                }
            } catch (Exception ignored) {}
        }
        return false;
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

        // Immediate child check
        if (isImmediateChild(operator, target)) {
            return true;
        }

        UUID operatorId = operator.getId();

        // Traverse upwards from target to see if operator is an ancestor
        int maxDepth = 10;
        int depth = 0;
        Set<UUID> visited = new HashSet<>();
        visited.add(target.getId());

        User current = target;
        while (depth++ < maxDepth) {
            User parent = getEffectiveParent(current);
            if (parent == null || visited.contains(parent.getId())) {
                break;
            }
            if (parent.getId().equals(operatorId)) {
                return true;
            }
            visited.add(parent.getId());
            current = parent;
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
