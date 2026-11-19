package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.AdminWalletOperationType;
import com.rupiksha.backend.domain.AdminWalletPinAuditLog;
import com.rupiksha.backend.domain.AdminWalletPinAuditOutcome;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface AdminWalletPinAuditLogRepository extends JpaRepository<AdminWalletPinAuditLog, Long> {

    Page<AdminWalletPinAuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    List<AdminWalletPinAuditLog> findByAdminUserIdOrderByTimestampDesc(UUID adminUserId);

    List<AdminWalletPinAuditLog> findByTargetUserIdOrderByTimestampDesc(UUID targetUserId);

    List<AdminWalletPinAuditLog> findByOperationTypeOrderByTimestampDesc(AdminWalletOperationType operationType);

    long countByAdminUserIdAndTimestampAfterAndOutcome(UUID adminUserId, Instant after, AdminWalletPinAuditOutcome outcome);

    long countBySourceIpAndTimestampAfterAndOutcome(String sourceIp, Instant after, AdminWalletPinAuditOutcome outcome);
}
