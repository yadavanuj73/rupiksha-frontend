package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "user_mappings")
public class UserMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_role", nullable = false, length = 40)
    @Builder.Default
    private String userRole = "RETAILER";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_parent_id")
    private User previousParent;

    @Column(name = "previous_parent_role", length = 40)
    private String previousParentRole;

    @Column(name = "previous_parent_name", length = 120)
    private String previousParentName;

    @Column(name = "previous_parent_party_code", length = 80)
    private String previousParentPartyCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "new_parent_id")
    private User newParent;

    @Column(name = "new_parent_role", nullable = false, length = 40)
    private String newParentRole;

    @Column(name = "new_parent_name", length = 120)
    private String newParentName;

    @Column(name = "new_parent_party_code", length = 80)
    private String newParentPartyCode;

    @Column(name = "action_type", nullable = false, length = 50)
    @Builder.Default
    private String actionType = "MAP_USER";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mapped_by_admin_id")
    private User mappedByAdmin;

    @Column(name = "mapped_by_admin_username", length = 80)
    private String mappedByAdminUsername;

    @Column(name = "reason", columnDefinition = "text")
    private String reason;

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
