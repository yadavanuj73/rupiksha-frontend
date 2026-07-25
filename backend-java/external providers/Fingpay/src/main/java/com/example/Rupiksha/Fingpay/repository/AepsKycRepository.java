package com.example.Rupiksha.Fingpay.repository;

import com.example.Rupiksha.Fingpay.entity.AepsKyc;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AepsKycRepository extends JpaRepository<AepsKyc, Long> {
    Optional<AepsKyc> findByUid(Long uid);
}