package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "employee_audit_logs")
public class EmployeeAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "employee_id")
    private UUID employeeId;

    @Column(name = "employee_username", length = 80)
    private String employeeUsername;

    @Column(name = "actor_type", nullable = false, length = 20)
    private String actorType;

    @Column(name = "actor_id", length = 64)
    private String actorId;

    @Column(name = "actor_username", length = 80)
    private String actorUsername;

    @Column(name = "event_type", nullable = false, length = 60)
    private String eventType;

    @Column(name = "target_user_id")
    private UUID targetUserId;

    @Column(name = "target_employee_id")
    private UUID targetEmployeeId;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "outcome", nullable = false, length = 30)
    private String outcome;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
