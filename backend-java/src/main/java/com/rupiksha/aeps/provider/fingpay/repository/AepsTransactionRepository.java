package com.rupiksha.aeps.provider.fingpay.repository;

import com.rupiksha.aeps.provider.fingpay.entity.AepsTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AepsTransactionRepository extends JpaRepository<AepsTransaction, Long> {

    Optional<AepsTransaction> findByTxnid(String txnid);

}