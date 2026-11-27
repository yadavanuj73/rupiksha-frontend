package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.domain.Employee;
import com.rupiksha.backend.domain.EmployeePermission;
import com.rupiksha.backend.domain.EmployeePermissionCatalog;
import com.rupiksha.backend.repository.EmployeePermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class EmployeePermissionService {

    private final EmployeePermissionRepository employeePermissionRepository;

    public List<EmployeeDtos.PermissionCategoryView> getCatalogView() {
        Map<String, String> catLabels = new LinkedHashMap<>();
        Map<String, List<EmployeeDtos.PermissionItemView>> grouped = new LinkedHashMap<>();

        for (EmployeePermissionCatalog.PermissionDefinition def : EmployeePermissionCatalog.allDefinitions()) {
            catLabels.putIfAbsent(def.category(), def.categoryLabel());
            grouped.computeIfAbsent(def.category(), k -> new ArrayList<>())
                    .add(new EmployeeDtos.PermissionItemView(
                            def.code(),
                            def.label(),
                            def.description(),
                            def.onboardingWrite()
                    ));
        }

        List<EmployeeDtos.PermissionCategoryView> result = new ArrayList<>();
        for (Map.Entry<String, List<EmployeeDtos.PermissionItemView>> entry : grouped.entrySet()) {
            result.add(new EmployeeDtos.PermissionCategoryView(
                    entry.getKey(),
                    catLabels.get(entry.getKey()),
                    entry.getValue()
            ));
        }
        return result;
    }

    public List<EmployeePermission> resolveAndBuildPermissions(
            Employee employee,
            List<String> requestedCodes,
            UUID adminId
    ) {
        if (requestedCodes == null || requestedCodes.isEmpty()) {
            return List.of();
        }
        Map<String, EmployeePermission> unique = new LinkedHashMap<>();
        for (String raw : requestedCodes) {
            if (raw == null || raw.isBlank()) continue;
            EmployeePermissionCatalog.PermissionDefinition def = EmployeePermissionCatalog.resolveStrict(raw);
            if (!unique.containsKey(def.code())) {
                EmployeePermission ep = new EmployeePermission();
                ep.setEmployee(employee);
                ep.setCategory(def.category());
                ep.setPermissionCode(def.code());
                ep.setGrantedByAdminId(adminId);
                unique.put(def.code(), ep);
            }
        }
        return new ArrayList<>(unique.values());
    }

    public Set<String> getPermissionCodes(UUID employeeId) {
        List<EmployeePermission> list = employeePermissionRepository.findByEmployeeId(employeeId);
        Set<String> codes = new LinkedHashSet<>();
        for (EmployeePermission ep : list) {
            if (EmployeePermissionCatalog.isValidPermissionCode(ep.getPermissionCode())) {
                codes.add(ep.getPermissionCode());
            }
        }
        return codes;
    }

    public boolean hasPermission(UUID employeeId, String permissionCode) {
        return getPermissionCodes(employeeId).contains(permissionCode);
    }

    public boolean hasAnyPermission(UUID employeeId, String... permissionCodes) {
        Set<String> granted = getPermissionCodes(employeeId);
        for (String code : permissionCodes) {
            if (granted.contains(code)) {
                return true;
            }
        }
        return false;
    }

    public void requirePermission(UUID employeeId, String permissionCode) {
        if (!hasPermission(employeeId, permissionCode)) {
            throw new AccessDeniedException("Missing required employee permission: " + permissionCode);
        }
    }

    public void requireAnyPermission(UUID employeeId, String... permissionCodes) {
        if (!hasAnyPermission(employeeId, permissionCodes)) {
            throw new AccessDeniedException("You do not have permission to access this resource.");
        }
    }
}
