package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Recharge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RechargeRepository extends JpaRepository<Recharge, UUID> {
    Optional<Recharge> findByMerchantRefNo(String merchantRefNo);
}
