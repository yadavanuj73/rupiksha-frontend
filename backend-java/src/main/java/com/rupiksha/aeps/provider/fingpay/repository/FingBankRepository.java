package com.rupiksha.aeps.provider.fingpay.repository;

import com.rupiksha.aeps.provider.fingpay.entity.FingBank;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FingBankRepository extends JpaRepository<FingBank, Long> {
}