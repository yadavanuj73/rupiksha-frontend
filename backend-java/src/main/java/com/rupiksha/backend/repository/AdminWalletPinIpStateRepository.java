package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.AdminWalletPinIpState;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AdminWalletPinIpStateRepository extends JpaRepository<AdminWalletPinIpState, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM AdminWalletPinIpState s WHERE s.ipAddress = :ipAddress")
    Optional<AdminWalletPinIpState> findByIdForUpdate(@Param("ipAddress") String ipAddress);
}
