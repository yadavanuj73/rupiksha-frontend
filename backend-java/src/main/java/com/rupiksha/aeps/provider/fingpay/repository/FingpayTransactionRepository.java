package com.rupiksha.aeps.provider.fingpay.repository;

import com.rupiksha.aeps.provider.fingpay.entity.FingpayTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FingpayTransactionRepository extends JpaRepository<FingpayTransaction, Long> {

    Optional<FingpayTransaction> findByTxnid(String txnid);

}