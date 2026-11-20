package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.PayoutLimitSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PayoutLimitSettingsRepository extends JpaRepository<PayoutLimitSettings, Long> {
    Optional<PayoutLimitSettings> findById(Long id);
}
