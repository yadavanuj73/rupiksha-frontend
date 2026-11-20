package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.PayoutLimitSettingsAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PayoutLimitSettingsAuditLogRepository extends JpaRepository<PayoutLimitSettingsAuditLog, Long> {
    List<PayoutLimitSettingsAuditLog> findAllByOrderByEventTimestampDesc();
}
