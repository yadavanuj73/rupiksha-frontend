package com.example.Rupiksha.Fingpay.repository;

import com.example.Rupiksha.Fingpay.entity.AepsTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AepsTransactionRepository extends JpaRepository<AepsTransaction, Long> {

    Optional<AepsTransaction> findByTxnid(String txnid);

}