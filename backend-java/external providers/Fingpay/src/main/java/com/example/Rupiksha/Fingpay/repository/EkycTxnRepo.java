package com.example.Rupiksha.Fingpay.repository;

import com.example.Rupiksha.Fingpay.entity.EkycTxn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EkycTxnRepo extends JpaRepository<EkycTxn, Long> {

    Optional<EkycTxn> findByMerchantLoginId(String merchantLoginId);

}
