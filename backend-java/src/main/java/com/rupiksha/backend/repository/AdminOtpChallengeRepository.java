package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.AdminOtpChallenge;
import com.rupiksha.backend.domain.AdminOtpChallengeStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AdminOtpChallengeRepository extends JpaRepository<AdminOtpChallenge, Long> {

    Optional<AdminOtpChallenge> findByChallengeId(String challengeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM AdminOtpChallenge c WHERE c.challengeId = :challengeId")
    Optional<AdminOtpChallenge> findWithLockByChallengeId(@Param("challengeId") String challengeId);

    List<AdminOtpChallenge> findByAdminUserIdAndStatus(UUID adminUserId, AdminOtpChallengeStatus status);

    long countByIpAddressAndCreatedAtAfter(String ipAddress, Instant after);

    long countByAdminUserIdAndCreatedAtAfter(UUID adminUserId, Instant after);
}
