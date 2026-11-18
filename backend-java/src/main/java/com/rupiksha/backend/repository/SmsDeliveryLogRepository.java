package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.SmsDeliveryLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SmsDeliveryLogRepository extends JpaRepository<SmsDeliveryLog, Long> {
    Optional<SmsDeliveryLog> findByClientSmsId(String clientSmsId);
    Optional<SmsDeliveryLog> findByProviderMessageId(String providerMessageId);
}
