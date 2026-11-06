package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Aeps2faChargeSettlement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface Aeps2faChargeSettlementRepository extends JpaRepository<Aeps2faChargeSettlement, UUID>, JpaSpecificationExecutor<Aeps2faChargeSettlement> {

    List<Aeps2faChargeSettlement> findByChargeTxn_IdOrderByCreatedAtAsc(UUID chargeTxnId);

    Page<Aeps2faChargeSettlement> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<Aeps2faChargeSettlement> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

