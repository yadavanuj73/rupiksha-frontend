package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.PayoutOtpChallenge;
import com.rupiksha.aeps.entity.PayoutOtpStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PayoutOtpChallengeRepository extends JpaRepository<PayoutOtpChallenge, Long> {

    Optional<PayoutOtpChallenge> findByChallengeId(String challengeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM PayoutOtpChallenge c WHERE c.challengeId = :challengeId")
    Optional<PayoutOtpChallenge> findWithLockByChallengeId(@Param("challengeId") String challengeId);

    Optional<PayoutOtpChallenge> findByAuthorizationReference(String authorizationReference);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM PayoutOtpChallenge c WHERE c.authorizationReference = :authorizationReference")
    Optional<PayoutOtpChallenge> findWithLockByAuthorizationReference(@Param("authorizationReference") String authorizationReference);

    List<PayoutOtpChallenge> findByUserIdAndStatus(UUID userId, PayoutOtpStatus status);

    long countByIpAddressAndCreatedAtAfter(String ipAddress, Instant after);

    long countByUserIdAndCreatedAtAfter(UUID userId, Instant after);
}
