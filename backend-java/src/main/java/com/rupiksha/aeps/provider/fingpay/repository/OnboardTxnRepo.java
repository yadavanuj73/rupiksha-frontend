package com.rupiksha.aeps.provider.fingpay.repository;

import com.rupiksha.aeps.provider.fingpay.entity.OnboardTxn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OnboardTxnRepo extends JpaRepository<OnboardTxn, Long> {

    Optional<OnboardTxn> findByMerchantLoginId(String merchantLoginId);

}
