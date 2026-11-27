package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.EmployeePermission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface EmployeePermissionRepository extends JpaRepository<EmployeePermission, UUID> {
    List<EmployeePermission> findByEmployeeId(UUID employeeId);

    List<EmployeePermission> findByEmployeeIdIn(Collection<UUID> employeeIds);

    boolean existsByEmployeeIdAndPermissionCode(UUID employeeId, String permissionCode);

    void deleteByEmployeeId(UUID employeeId);
}
