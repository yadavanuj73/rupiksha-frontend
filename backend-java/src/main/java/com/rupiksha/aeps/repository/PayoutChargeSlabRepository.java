package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.PayoutChargeSlab;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PayoutChargeSlabRepository extends JpaRepository<PayoutChargeSlab, Long> {
    List<PayoutChargeSlab> findAllByIsActiveTrueOrderByMinAmountAsc();
    List<PayoutChargeSlab> findAllByOrderByMinAmountAsc();
}
