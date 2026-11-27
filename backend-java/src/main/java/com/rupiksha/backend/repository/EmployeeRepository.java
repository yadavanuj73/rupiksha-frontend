package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Employee;
import com.rupiksha.backend.domain.EmployeeRole;
import com.rupiksha.backend.domain.EmployeeStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmployeeRepository extends JpaRepository<Employee, UUID> {
    Optional<Employee> findByUsernameIgnoreCase(String username);

    Optional<Employee> findByEmployeeCodeIgnoreCase(String employeeCode);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmployeeCodeIgnoreCase(String employeeCode);

    boolean existsByMobile(String mobile);

    boolean existsByEmailIgnoreCase(String email);

    List<Employee> findByReportingManagerId(UUID reportingManagerId);

    List<Employee> findByEmployeeRoleInAndStatus(Collection<EmployeeRole> roles, EmployeeStatus status);

    List<Employee> findAllByOrderByCreatedAtDesc();
}
