package com.example.Rupiksha.Fingpay.repository;

import com.example.Rupiksha.Fingpay.entity.OnboardTxn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OnboardTxnRepo extends JpaRepository<OnboardTxn, Long> {

    Optional<OnboardTxn> findByMerchantLoginId(String merchantLoginId);

}
