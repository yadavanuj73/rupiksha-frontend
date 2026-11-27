package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.EmployeeScope;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface EmployeeScopeRepository extends JpaRepository<EmployeeScope, UUID> {
    List<EmployeeScope> findByEmployeeId(UUID employeeId);

    List<EmployeeScope> findByEmployeeIdIn(Collection<UUID> employeeIds);

    void deleteByEmployeeId(UUID employeeId);
}
