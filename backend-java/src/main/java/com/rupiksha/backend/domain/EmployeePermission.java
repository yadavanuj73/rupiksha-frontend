package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(
        name = "employee_permissions",
        uniqueConstraints = @UniqueConstraint(name = "uq_employee_permission", columnNames = {"employee_id", "permission_code"})
)
public class EmployeePermission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(name = "category", nullable = false, length = 60)
    private String category;

    @Column(name = "permission_code", nullable = false, length = 80)
    private String permissionCode;

    @Column(name = "granted_by_admin_id")
    private UUID grantedByAdminId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
