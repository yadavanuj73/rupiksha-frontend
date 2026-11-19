package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.AdminWalletPinSecurityState;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AdminWalletPinSecurityStateRepository extends JpaRepository<AdminWalletPinSecurityState, Long> {

    Optional<AdminWalletPinSecurityState> findByAdminUserId(UUID adminUserId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM AdminWalletPinSecurityState s WHERE s.adminUserId = :adminUserId")
    Optional<AdminWalletPinSecurityState> findByAdminUserIdForUpdate(@Param("adminUserId") UUID adminUserId);
}
