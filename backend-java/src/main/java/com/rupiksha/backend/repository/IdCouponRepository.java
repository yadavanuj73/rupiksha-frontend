package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.IdCoupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface IdCouponRepository extends JpaRepository<IdCoupon, UUID> {
    Optional<IdCoupon> findByCode(String code);
    Optional<IdCoupon> findByUserIdAndIsUsedFalseAndValidToAfter(UUID userId, Instant now);
    List<IdCoupon> findByUserIdOrderByCreatedAtDesc(UUID userId);
    boolean existsByCode(String code);
}
