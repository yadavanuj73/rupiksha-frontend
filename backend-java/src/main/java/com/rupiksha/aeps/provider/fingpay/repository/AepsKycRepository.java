package com.rupiksha.aeps.provider.fingpay.repository;

import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AepsKycRepository extends JpaRepository<AepsKyc, Long> {
    Optional<AepsKyc> findByUid(Long uid);
}