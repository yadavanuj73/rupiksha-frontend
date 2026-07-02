package com.rupiksha.aeps.provider.fingpay.repository;

import com.rupiksha.aeps.provider.fingpay.entity.EkycTxn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EkycTxnRepo extends JpaRepository<EkycTxn, Long> {

    Optional<EkycTxn> findByMerchantLoginId(String merchantLoginId);

}
