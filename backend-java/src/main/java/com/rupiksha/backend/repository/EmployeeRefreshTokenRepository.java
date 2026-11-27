package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.EmployeeRefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface EmployeeRefreshTokenRepository extends JpaRepository<EmployeeRefreshToken, UUID> {
    Optional<EmployeeRefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update EmployeeRefreshToken t set t.revoked = true where t.employee.id = :employeeId and t.revoked = false")
    int revokeAllByEmployeeId(@Param("employeeId") UUID employeeId);
}
