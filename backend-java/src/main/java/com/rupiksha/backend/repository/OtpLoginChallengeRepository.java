package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.OtpChallengeStatus;
import com.rupiksha.backend.domain.OtpLoginChallenge;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface OtpLoginChallengeRepository extends JpaRepository<OtpLoginChallenge, Long> {

    Optional<OtpLoginChallenge> findByChallengeId(String challengeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM OtpLoginChallenge c WHERE c.challengeId = :challengeId")
    Optional<OtpLoginChallenge> findWithLockByChallengeId(@Param("challengeId") String challengeId);

    List<OtpLoginChallenge> findByMobileNumberAndExpectedRoleAndStatus(
            String mobileNumber,
            String expectedRole,
            OtpChallengeStatus status
    );

    long countByIpAddressAndCreatedAtAfter(String ipAddress, Instant after);

    long countByMobileNumberAndCreatedAtAfter(String mobileNumber, Instant after);

    @Modifying
    @Query("DELETE FROM OtpLoginChallenge c WHERE c.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}

