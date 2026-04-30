package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.AepsTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AepsTransactionRepository
extends JpaRepository<AepsTransaction,Long> {

List<AepsTransaction> findByMobile(String mobile);

}